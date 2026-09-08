import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PublicacionesSocialesRepository } from './publicaciones-sociales.repository';
import { CrearPublicacionSocialDto } from './dto/crear-publicacion-social.dto';
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
import { OrigenImagenPublicacionSocial } from '@prisma/client';
import { OfertasService } from '../ofertas/ofertas.service';
import { construirPromptFondoIa } from './construir-prompt-fondo-ia';

@Injectable()
export class PublicacionesSocialesService {
  constructor(
    private readonly publicacionesSocialesRepository: PublicacionesSocialesRepository,
    private readonly prisma: PrismaService,
    private readonly whatsappConfigRepository: WhatsappConfigRepository,
    private readonly generadorFondoService: GeneradorFondoService,
    private readonly ofertasService: OfertasService,
  ) {}

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

    let imagen: string;
    let origenImagen: OrigenImagenPublicacionSocial;

    if (dto.promptIa?.trim()) {
      const [usadas, limite] = await Promise.all([
        this.publicacionesSocialesRepository.contarGeneracionesIaDelMes(tenantId),
        this.publicacionesSocialesRepository.buscarLimiteIaFondo(),
      ]);
      if (usadas >= limite) {
        throw new BadRequestException(`Alcanzaste el límite de ${limite} generación(es) con IA este mes para este negocio`);
      }

      const oferta = await this.ofertasService.resolverOfertaVisibleProducto(producto.id, producto.categoriaId, Number(precioVenta));
      const prompt = construirPromptFondoIa({
        productoNombre: producto.nombre,
        precioFormateado: formatearMontoDop(Number(precioVenta)),
        oferta,
        plantillaClave: plantilla.clave,
        promptUsuario: dto.promptIa,
        tieneLogo: Boolean(logo),
      });
      imagen = await this.generadorFondoService.generarDesdeDataUri(producto.imagen, prompt, dto.formato ?? 'CUADRADO', logo);
      origenImagen = 'IA';
    } else {
      imagen = await generarImagenPublicacionSocial({
        plantillaClave: plantilla.clave,
        productoNombre: producto.nombre,
        precioFormateado: formatearMontoDop(Number(precioVenta)),
        imagenProductoDataUri: producto.imagen,
        logoTenantDataUri: logo,
      });
      origenImagen = 'FOTO_PRODUCTO';
    }

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

  async enviarAAprobacion(id: string) {
    const publicacion = await this.publicacionesSocialesRepository.buscarPorId(id);
    if (publicacion.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo una publicación en BORRADOR puede enviarse a aprobación');
    }
    return this.publicacionesSocialesRepository.actualizarEstado(id, { estado: 'PENDIENTE_APROBACION' });
  }

  async cambiarEstado(id: string, estado: 'APROBADA' | 'RECHAZADA', aprobadoPorId: string, motivoRechazo?: string) {
    const publicacion = await this.publicacionesSocialesRepository.buscarPorId(id);
    if (publicacion.estado !== 'PENDIENTE_APROBACION') {
      throw new BadRequestException('Solo una publicación PENDIENTE_APROBACION puede aprobarse o rechazarse');
    }
    if (estado === 'RECHAZADA' && !motivoRechazo?.trim()) {
      throw new BadRequestException('Rechazar una publicación requiere indicar un motivo');
    }
    return this.publicacionesSocialesRepository.actualizarEstado(id, {
      estado,
      aprobadoPorId,
      fechaResolucion: new Date(),
      ...(estado === 'RECHAZADA' ? { motivoRechazo } : {}),
    });
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
