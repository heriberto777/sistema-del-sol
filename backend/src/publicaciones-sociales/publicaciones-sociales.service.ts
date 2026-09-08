import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PublicacionesSocialesRepository } from './publicaciones-sociales.repository';
import { CrearPublicacionSocialDto } from './dto/crear-publicacion-social.dto';
import { RegenerarPublicacionSocialDto } from './dto/regenerar-publicacion-social.dto';
import { ListarPublicacionesSocialesQueryDto } from './dto/listar-publicaciones-sociales-query.dto';
import { generarImagenPublicacionSocial } from './generador-imagen-publicacion-social';
import { formatearMontoDop } from '../common/pdf/formato-monto';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappConfigRepository } from '../whatsapp-config/whatsapp-config.repository';
import { descifrar } from '../common/utils/encriptado.util';
import { enviarWhatsappTwilio } from '../common/utils/twilio-whatsapp.util';
import { resolverOrigenPublicoWhatsapp } from '../common/utils/origen-publico-whatsapp.util';
import { paginar } from '../common/types/pagina-resultado';
import { GeneradorFondoService } from '../ia/generador-fondo/generador-fondo.service';
import { FormatoFondo } from '../ia/generador-fondo/generador-fondo.interface';
import { OrigenImagenPublicacionSocial } from '@prisma/client';
import { OfertasService } from '../ofertas/ofertas.service';
import { construirPromptFondoIa } from './construir-prompt-fondo-ia';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

@Injectable()
export class PublicacionesSocialesService {
  constructor(
    private readonly publicacionesSocialesRepository: PublicacionesSocialesRepository,
    private readonly prisma: PrismaService,
    private readonly whatsappConfigRepository: WhatsappConfigRepository,
    private readonly generadorFondoService: GeneradorFondoService,
    private readonly ofertasService: OfertasService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Extraído de `crear()`/`regenerar()` (Fase 5) — misma lógica exacta
   * de Fase 3: sin `promptIa`, plantilla fija + Canvas; con `promptIa`,
   * la IA diseña la pieza completa (precio/oferta reales inyectados),
   * nunca se mezclan.
   */
  private async generarImagen(params: {
    tenantId: string;
    producto: { id: string; nombre: string; imagen: string | null; categoriaId: string | null };
    plantilla: { clave: string };
    precioVenta: number;
    promptIa?: string;
    formato: FormatoFondo;
    logo?: string;
  }): Promise<{ imagen: string; origenImagen: OrigenImagenPublicacionSocial }> {
    if (params.promptIa?.trim()) {
      const [usadas, limite] = await Promise.all([
        this.publicacionesSocialesRepository.contarGeneracionesIaDelMes(params.tenantId),
        this.publicacionesSocialesRepository.buscarLimiteIaFondo(),
      ]);
      if (usadas >= limite) {
        throw new BadRequestException(`Alcanzaste el límite de ${limite} generación(es) con IA este mes para este negocio`);
      }

      const oferta = await this.ofertasService.resolverOfertaVisibleProducto(params.producto.id, params.producto.categoriaId, params.precioVenta);
      const prompt = construirPromptFondoIa({
        productoNombre: params.producto.nombre,
        precioFormateado: formatearMontoDop(params.precioVenta),
        oferta,
        plantillaClave: params.plantilla.clave,
        promptUsuario: params.promptIa,
        tieneLogo: Boolean(params.logo),
      });
      const imagen = await this.generadorFondoService.generarDesdeDataUri(params.producto.imagen as string, prompt, params.formato, params.logo);
      return { imagen, origenImagen: 'IA' };
    }

    const imagen = await generarImagenPublicacionSocial({
      plantillaClave: params.plantilla.clave,
      productoNombre: params.producto.nombre,
      precioFormateado: formatearMontoDop(params.precioVenta),
      imagenProductoDataUri: params.producto.imagen as string,
      logoTenantDataUri: params.logo,
    });
    return { imagen, origenImagen: 'FOTO_PRODUCTO' };
  }

  /**
   * Genera el banner de forma síncrona (no hace falta cola, ver el plan
   * de Fase 1) y lo deja en BORRADOR — previsualizable antes de
   * enviarlo a aprobación. Dos caminos posibles, sin mezclar:
   * - Sin `promptIa`: plantilla fija + Canvas (Fase 1), sin cambios.
   * - Con `promptIa` (Fase 3): la IA diseña la pieza COMPLETA (incluido
   *   precio/oferta reales, ya armados en el prompt) — el resultado de
   *   la IA ES la imagen final, nunca se le superpone Canvas encima
   *   (evita el bug real de dos precios distintos en la misma imagen).
   */
  async crear(dto: CrearPublicacionSocialDto, tenantId: string, creadoPorId: string) {
    if (dto.formato === 'VERTICAL' && !dto.promptIa?.trim()) {
      throw new BadRequestException(
        'El formato vertical solo está disponible generando con IA — agregá una ambientación o elegí formato cuadrado',
      );
    }

    const producto = await this.publicacionesSocialesRepository.buscarProductoParaGenerar(dto.productoId);
    if (!producto.imagen) {
      throw new BadRequestException('Este producto no tiene foto cargada');
    }
    const precioVenta = producto.variantes[0]?.precios[0]?.precioVenta;
    if (precioVenta == null) {
      throw new BadRequestException('Este producto no tiene un precio de venta vigente en la lista GENERAL');
    }

    const plantilla = await this.publicacionesSocialesRepository.buscarPlantillaPorId(dto.plantillaId);
    if (!plantilla.activa) {
      throw new BadRequestException(`La plantilla "${plantilla.nombre}" ya no está activa`);
    }

    const { logo } = await resolverPersonalizacionDocumento(this.prisma, tenantId);

    const { imagen, origenImagen } = await this.generarImagen({
      tenantId,
      producto,
      plantilla,
      precioVenta: Number(precioVenta),
      promptIa: dto.promptIa,
      formato: dto.formato ?? 'CUADRADO',
      logo,
    });

    return this.publicacionesSocialesRepository.crear({
      tenantId,
      productoId: dto.productoId,
      plantillaId: dto.plantillaId,
      imagen,
      creadoPorId,
      origen: origenImagen,
      promptIa: dto.promptIa ?? null,
      formato: dto.formato ?? 'CUADRADO',
    });
  }

  /** Enriquece con el precio/oferta REAL del producto — visible al lado de la imagen para que quien aprueba pueda comparar contra lo que dibujó la IA (Fase 3). */
  async buscarPorId(id: string) {
    const publicacion = await this.publicacionesSocialesRepository.buscarPorId(id);
    const precioVenta = publicacion.producto.variantes[0]?.precios[0]?.precioVenta;
    const oferta =
      precioVenta != null
        ? await this.ofertasService.resolverOfertaVisibleProducto(publicacion.producto.id, publicacion.producto.categoriaId, Number(precioVenta))
        : null;
    return {
      ...publicacion,
      producto: {
        ...publicacion.producto,
        precioFormateado: precioVenta != null ? formatearMontoDop(Number(precioVenta)) : null,
        precioConDescuentoFormateado: oferta?.tipo === 'DESCUENTO' ? formatearMontoDop(oferta.precioConDescuento) : null,
        oferta,
      },
    };
  }

  async listar(query: ListarPublicacionesSocialesQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.publicacionesSocialesRepository.listar({ skip, take, estado: query.estado });
    return { datos, total, pagina, tamanoPagina };
  }

  listarPlantillas() {
    return this.publicacionesSocialesRepository.listarPlantillasActivas();
  }

  /** Fase 5 — dispara el aviso a todos los aprobadores del tenant (Email siempre, WhatsApp del negocio si está configurado). */
  async enviarAAprobacion(id: string, tenantId: string) {
    const publicacion = await this.publicacionesSocialesRepository.buscarPorId(id);
    if (publicacion.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo una publicación en BORRADOR puede enviarse a aprobación');
    }
    const actualizada = await this.publicacionesSocialesRepository.actualizarEstado(id, { estado: 'PENDIENTE_APROBACION' });
    this.eventBus.emit(EVENTOS.PUBLICACION_SOCIAL_PENDIENTE_APROBACION, {
      tenantId,
      publicacionId: id,
      productoNombre: publicacion.producto.nombre,
    });
    return actualizada;
  }

  /** Fase 5 — cierra el ciclo avisándole al creador el resultado final. */
  async cambiarEstado(id: string, estado: 'APROBADA' | 'RECHAZADA', aprobadoPorId: string, tenantId: string, motivoRechazo?: string) {
    const publicacion = await this.publicacionesSocialesRepository.buscarPorId(id);
    if (publicacion.estado !== 'PENDIENTE_APROBACION') {
      throw new BadRequestException('Solo una publicación PENDIENTE_APROBACION puede aprobarse o rechazarse');
    }
    if (estado === 'RECHAZADA' && !motivoRechazo?.trim()) {
      throw new BadRequestException('Rechazar una publicación requiere indicar un motivo');
    }
    const actualizada = await this.publicacionesSocialesRepository.actualizarEstado(id, {
      estado,
      aprobadoPorId,
      fechaResolucion: new Date(),
      ...(estado === 'RECHAZADA' ? { motivoRechazo } : {}),
    });
    if (estado === 'APROBADA') {
      this.eventBus.emit(EVENTOS.PUBLICACION_SOCIAL_APROBADA, {
        tenantId,
        publicacionId: id,
        productoNombre: publicacion.producto.nombre,
        creadoPorId: publicacion.creadoPorId,
      });
    } else {
      this.eventBus.emit(EVENTOS.PUBLICACION_SOCIAL_RECHAZADA, {
        tenantId,
        publicacionId: id,
        productoNombre: publicacion.producto.nombre,
        creadoPorId: publicacion.creadoPorId,
        motivoRechazo: motivoRechazo as string,
      });
    }
    return actualizada;
  }

  /**
   * Fase 5 — NO es un rechazo definitivo: guarda el comentario en la
   * versión que se estaba revisando y vuelve a `BORRADOR` recién cuando
   * el creador regenera (ver `regenerar`), nunca automáticamente acá.
   */
  async solicitarCambios(id: string, tenantId: string, aprobadorId: string, comentario: string) {
    const publicacion = await this.publicacionesSocialesRepository.buscarPorId(id);
    if (publicacion.estado !== 'PENDIENTE_APROBACION') {
      throw new BadRequestException('Solo una publicación PENDIENTE_APROBACION puede recibir un pedido de cambios');
    }

    const versionVigente = publicacion.versiones[publicacion.versiones.length - 1];
    await this.publicacionesSocialesRepository.actualizarComentarioVersion(versionVigente.id, comentario);
    const actualizada = await this.publicacionesSocialesRepository.actualizarEstado(id, {
      estado: 'CAMBIOS_SOLICITADOS',
      aprobadoPorId: aprobadorId,
      fechaResolucion: new Date(),
    });
    this.eventBus.emit(EVENTOS.PUBLICACION_SOCIAL_CAMBIOS_SOLICITADOS, {
      tenantId,
      publicacionId: id,
      productoNombre: publicacion.producto.nombre,
      creadoPorId: publicacion.creadoPorId,
      comentario,
    });
    return actualizada;
  }

  /**
   * Fase 5 — el creador responde a un pedido de cambios: regenera la
   * imagen (mismo camino Canvas/IA de `crear()`, vía `generarImagen`) y
   * agrega una versión nueva al historial en vez de pisar la anterior.
   * Solo válido desde `CAMBIOS_SOLICITADOS`; el estado vuelve a
   * `BORRADOR`, listo para reenviarse a aprobación cuantas veces haga
   * falta.
   */
  async regenerar(id: string, tenantId: string, creadorId: string, cambios: RegenerarPublicacionSocialDto) {
    const publicacion = await this.publicacionesSocialesRepository.buscarPorId(id);
    if (publicacion.estado !== 'CAMBIOS_SOLICITADOS') {
      throw new BadRequestException('Solo se puede regenerar una publicación con cambios solicitados');
    }

    const plantillaId = cambios.plantillaId ?? publicacion.plantillaId;
    const promptIa = cambios.promptIa !== undefined ? cambios.promptIa : (publicacion.promptIa ?? undefined);
    const formato = cambios.formato ?? publicacion.formato;

    if (formato === 'VERTICAL' && !promptIa?.trim()) {
      throw new BadRequestException(
        'El formato vertical solo está disponible generando con IA — agregá una ambientación o elegí formato cuadrado',
      );
    }

    const producto = await this.publicacionesSocialesRepository.buscarProductoParaGenerar(publicacion.productoId);
    if (!producto.imagen) {
      throw new BadRequestException('Este producto no tiene foto cargada');
    }
    const precioVenta = producto.variantes[0]?.precios[0]?.precioVenta;
    if (precioVenta == null) {
      throw new BadRequestException('Este producto no tiene un precio de venta vigente en la lista GENERAL');
    }

    const plantilla = await this.publicacionesSocialesRepository.buscarPlantillaPorId(plantillaId);
    if (!plantilla.activa) {
      throw new BadRequestException(`La plantilla "${plantilla.nombre}" ya no está activa`);
    }

    const { logo } = await resolverPersonalizacionDocumento(this.prisma, tenantId);

    const { imagen, origenImagen } = await this.generarImagen({
      tenantId,
      producto,
      plantilla,
      precioVenta: Number(precioVenta),
      promptIa,
      formato,
      logo,
    });

    return this.publicacionesSocialesRepository.regenerar(id, {
      numero: publicacion.versiones.length + 1,
      imagen,
      plantillaId: plantilla.id,
      origen: origenImagen,
      promptIa: promptIa ?? null,
      formato,
      creadoPorId: creadorId,
    });
  }

  /**
   * Fase 5 — llamado desde el webhook PÚBLICO de WhatsApp entrante (sin
   * JWT), cuando alguien toca el botón "✅ Aprobar" de la plantilla de
   * aprobación. Por eso usa `this.prisma` (global) con `tenantId`
   * explícito en cada where, igual criterio que `NotificacionesService`/
   * `WhatsappBotService` — `TenantPrismaService` exige `request.user`,
   * que en un webhook público no existe.
   *
   * Devuelve `false` solo si el teléfono no es de un aprobador conocido
   * (el webhook debe seguir con el bot conversacional normal); en
   * cualquier otro caso devuelve `true` — ya contestó por WhatsApp, sin
   * importar si había 0, 1 o varias publicaciones pendientes (con más de
   * una, NO adivina cuál — pide entrar a la app en vez de aprobar la
   * incorrecta).
   */
  async intentarAprobarPorWhatsapp(tenantId: string, telefono: string): Promise<boolean> {
    const aprobador = await this.prisma.user.findFirst({
      where: {
        tenantId,
        activo: true,
        telefono,
        roles: { some: { role: { rolePermissions: { some: { permission: { clave: 'publicacionessociales.aprobar' } } } } } },
      },
    });
    if (!aprobador) return false;

    const pendientes = await this.prisma.publicacionSocial.findMany({
      where: { tenantId, estado: 'PENDIENTE_APROBACION' },
      include: { producto: { select: { nombre: true } } },
    });

    let mensaje: string;
    if (pendientes.length === 0) {
      mensaje = 'No hay ningún diseño pendiente de aprobar en este momento.';
    } else if (pendientes.length > 1) {
      mensaje = `Hay ${pendientes.length} diseños pendientes — entrá a la app para elegir cuál aprobar.`;
    } else {
      const publicacion = pendientes[0];
      await this.prisma.publicacionSocial.update({
        where: { id: publicacion.id },
        data: { estado: 'APROBADA', aprobadoPorId: aprobador.id, fechaResolucion: new Date() },
      });
      this.eventBus.emit(EVENTOS.PUBLICACION_SOCIAL_APROBADA, {
        tenantId,
        publicacionId: publicacion.id,
        productoNombre: publicacion.producto.nombre,
        creadoPorId: publicacion.creadoPorId,
      });
      mensaje = `Listo, aprobaste el diseño de "${publicacion.producto.nombre}".`;
    }

    // OJO: `this.prisma` (global) directo, NUNCA `whatsappConfigRepository`
    // acá — este método corre desde el webhook PÚBLICO de WhatsApp, sin
    // `request.user`, y `WhatsappConfigRepository` usa `TenantPrismaService`
    // (request-scoped), que revienta con `ForbiddenException` sin eso
    // (bug real encontrado probando esto en vivo).
    const config = await this.prisma.whatsappConfigTenant.findUnique({ where: { tenantId } });
    if (config?.twilioAccountSid && config.twilioAuthTokenCifrado && config.twilioWhatsappFrom) {
      await enviarWhatsappTwilio({
        accountSid: config.twilioAccountSid,
        authToken: descifrar(config.twilioAuthTokenCifrado),
        from: `whatsapp:${config.twilioWhatsappFrom}`,
        to: telefono,
        body: mensaje,
      });
    }
    return true;
  }

  /**
   * Botón manual "Enviar por WhatsApp" — nunca automático (ver plan Fase
   * 1). Solo disponible sobre una publicación ya APROBADA, mismo patrón
   * que `WhatsappBandejaService.responder()`.
   */
  async enviarPorWhatsapp(id: string, telefono: string, tenantId: string) {
    const publicacion = await this.publicacionesSocialesRepository.buscarPorId(id);
    if (publicacion.estado !== 'APROBADA') {
      throw new BadRequestException('Solo una publicación APROBADA puede enviarse por WhatsApp');
    }

    const config = await this.whatsappConfigRepository.obtenerOCrear(tenantId);
    if (!config.twilioAccountSid || !config.twilioAuthTokenCifrado || !config.twilioWhatsappFrom) {
      throw new ServiceUnavailableException('Este negocio no tiene credenciales de Twilio configuradas');
    }
    const origen = resolverOrigenPublicoWhatsapp();
    if (!origen) {
      throw new ServiceUnavailableException('WHATSAPP_WEBHOOK_URL no está configurada — no se puede armar el link de la imagen');
    }
    const mediaUrl = `${origen}/api/public/publicaciones-sociales/${id}/imagen`;

    const enviado = await enviarWhatsappTwilio({
      accountSid: config.twilioAccountSid,
      authToken: descifrar(config.twilioAuthTokenCifrado),
      from: `whatsapp:${config.twilioWhatsappFrom}`,
      to: telefono.replace(/^whatsapp:/, ''),
      body: `${publicacion.producto.nombre} — diseño listo para publicar`,
      mediaUrl,
    });
    if (!enviado) {
      throw new ServiceUnavailableException('Twilio respondió con error al enviar el mensaje');
    }
  }
}
