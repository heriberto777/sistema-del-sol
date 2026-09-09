import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CanalNotificacion } from '@prisma/client';
import { NotificacionesRepository } from './notificaciones.repository';
import { EmailChannel } from './canales/email.channel';
import { WhatsAppChannel } from './canales/whatsapp.channel';
import { renderizarPlantilla } from './plantilla-renderer';
import {
  CotizacionEnviadaPayload,
  EVENTOS,
  FacturaCreadaPayload,
  HitoProyectoPorVencerPayload,
  LotePorVencerPayload,
  NcfPorAgotarsePayload,
  ProyectoPresupuestoSuperadoPayload,
  PublicacionSocialAprobadaPayload,
  PublicacionSocialCambiosSolicitadosPayload,
  PublicacionSocialPendienteAprobacionPayload,
  PublicacionSocialRechazadaPayload,
  StockBajoPayload,
  TareaProyectoComentadaPayload,
  WhatsappRequiereAtencionPayload,
} from '../event-bus/events';
import { PrismaService } from '../prisma/prisma.service';
import { CrearPlantillaDto } from './dto/crear-plantilla.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { generarDocumentoPdf } from '../common/pdf/documento-pdf';
import { mapearFacturaAParams } from '../facturacion/mapear-factura-pdf';
import { mapearCotizacionAParams } from '../cotizaciones/mapear-cotizacion-pdf';
import { descifrar } from '../common/utils/encriptado.util';
import { enviarWhatsappTwilio } from '../common/utils/twilio-whatsapp.util';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private readonly notificacionesRepository: NotificacionesRepository,
    private readonly emailChannel: EmailChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly prisma: PrismaService,
  ) {}

  async enviar(params: {
    tenantId: string;
    canal: CanalNotificacion;
    clave: string;
    destinatario: string;
    variables: Record<string, string>;
    // Ítem H-4 — solo tiene efecto en canal EMAIL (WhatsApp no soporta
    // adjuntos sin usar mensajes de media de Twilio, fuera de alcance);
    // el link `{{variables.link}}` es lo que cubre ambos canales.
    adjuntoPdf?: { filename: string; content: Buffer };
  }) {
    const plantilla = await this.notificacionesRepository.buscarPlantilla(params.tenantId, params.canal, params.clave);
    if (!plantilla?.activa) {
      this.logger.warn(`No hay plantilla activa "${params.clave}" (${params.canal}) para el tenant ${params.tenantId}`);
      return null;
    }

    const asunto = plantilla.asunto ? renderizarPlantilla(plantilla.asunto, params.variables) : undefined;
    const cuerpo = renderizarPlantilla(plantilla.cuerpo, params.variables);

    const notificacion = await this.notificacionesRepository.crearNotificacion(
      params.tenantId,
      params.canal,
      params.destinatario,
      asunto,
      cuerpo,
    );

    let enviada = true;
    if (params.canal === 'EMAIL') {
      enviada = await this.emailChannel.enviar(params.destinatario, asunto ?? '', cuerpo, params.adjuntoPdf ? [params.adjuntoPdf] : undefined);
    } else if (params.canal === 'WHATSAPP') {
      enviada = await this.whatsAppChannel.enviar(params.destinatario, asunto ?? '', cuerpo);
    }

    await this.notificacionesRepository.marcarEstado(notificacion.id, enviada ? 'ENVIADA' : 'FALLIDA');
    return notificacion;
  }

  listarPlantillas(tenantId: string) {
    return this.notificacionesRepository.listarPlantillas(tenantId);
  }

  guardarPlantilla(tenantId: string, dto: CrearPlantillaDto) {
    return this.notificacionesRepository.upsertPlantilla(tenantId, dto);
  }

  async listar(tenantId: string, query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.notificacionesRepository.listarPorTenant(tenantId, {
      skip,
      take,
      busqueda: query.busqueda,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  /**
   * Ítem H-4 — link público de solo lectura (`documentos-publicos/`, sin
   * JWT) para que el cliente vea el documento real detrás del aviso de
   * texto. Mismo `FRONTEND_URL` que ya arma el link de pago de plataforma
   * (`facturas-plataforma.service.ts`).
   */
  private enlacePublico(tipo: 'facturas' | 'cotizaciones', id: string): string {
    return `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/ver-${tipo === 'facturas' ? 'factura' : 'cotizacion'}/${id}`;
  }

  /**
   * PDF adjunto (solo EMAIL — ver el comentario en `enviar()`). Nunca
   * bloquea el envío de la notificación de texto: si algo falla acá
   * (factura ya no existe, error de pdfkit), se loguea y se manda igual
   * sin adjunto — el link de arriba sigue funcionando de todos modos.
   */
  private async generarAdjuntoFacturaPdf(facturaId: string) {
    try {
      const factura = await this.prisma.factura.findUnique({
        where: { id: facturaId },
        include: { cliente: true, lineas: { include: { producto: true } }, recargos: { orderBy: { orden: 'asc' } } },
      });
      if (!factura) return undefined;
      return { filename: 'factura.pdf', content: await generarDocumentoPdf(mapearFacturaAParams(factura)) };
    } catch (error) {
      this.logger.warn(`No se pudo generar el PDF adjunto de la factura ${facturaId}: ${(error as Error).message}`);
      return undefined;
    }
  }

  private async generarAdjuntoCotizacionPdf(cotizacionId: string) {
    try {
      const cotizacion = await this.prisma.cotizacion.findUnique({
        where: { id: cotizacionId },
        include: { cliente: true, lineas: { include: { producto: true } } },
      });
      if (!cotizacion) return undefined;
      return { filename: 'cotizacion.pdf', content: await generarDocumentoPdf(mapearCotizacionAParams(cotizacion)) };
    } catch (error) {
      this.logger.warn(`No se pudo generar el PDF adjunto de la cotización ${cotizacionId}: ${(error as Error).message}`);
      return undefined;
    }
  }

  @OnEvent(EVENTOS.FACTURA_CREADA)
  async alFacturarse(payload: FacturaCreadaPayload) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: payload.clienteId } });
    if (!cliente) return;

    const variables = { cliente_nombre: cliente.nombre, factura_total: payload.total, link: this.enlacePublico('facturas', payload.facturaId) };

    if (cliente.email) {
      const adjuntoPdf = await this.generarAdjuntoFacturaPdf(payload.facturaId);
      await this.enviar({ tenantId: payload.tenantId, canal: 'EMAIL', clave: 'factura_creada', destinatario: cliente.email, variables, adjuntoPdf });
    }
    // Por WhatsApp solo se envía si el tenant configuró una plantilla
    // WHATSAPP para "factura_creada" — enviar() no hace nada si no existe
    // una plantilla activa, así que esto es un no-op silencioso por defecto.
    if (cliente.telefono) {
      await this.enviar({ tenantId: payload.tenantId, canal: 'WHATSAPP', clave: 'factura_creada', destinatario: cliente.telefono, variables });
    }
  }

  @OnEvent(EVENTOS.COTIZACION_ENVIADA)
  async alEnviarCotizacion(payload: CotizacionEnviadaPayload) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: payload.clienteId } });
    if (!cliente) return;

    const variables = {
      cliente_nombre: cliente.nombre,
      cotizacion_numero: payload.numero,
      cotizacion_total: payload.total,
      link: this.enlacePublico('cotizaciones', payload.cotizacionId),
    };

    if (cliente.email) {
      const adjuntoPdf = await this.generarAdjuntoCotizacionPdf(payload.cotizacionId);
      await this.enviar({ tenantId: payload.tenantId, canal: 'EMAIL', clave: 'cotizacion_enviada', destinatario: cliente.email, variables, adjuntoPdf });
    }
    if (cliente.telefono) {
      await this.enviar({ tenantId: payload.tenantId, canal: 'WHATSAPP', clave: 'cotizacion_enviada', destinatario: cliente.telefono, variables });
    }
  }

  @OnEvent(EVENTOS.STOCK_BAJO)
  async alBajarStock(payload: StockBajoPayload) {
    const admins = await this.prisma.user.findMany({
      where: { tenantId: payload.tenantId, roles: { some: { role: { nombre: { in: ['Admin Total', 'Almacenero'] } } } } },
    });

    for (const admin of admins) {
      await this.enviar({
        tenantId: payload.tenantId,
        canal: 'EMAIL',
        clave: 'stock_bajo',
        destinatario: admin.email,
        variables: {
          producto_id: payload.productoId,
          cantidad_actual: payload.cantidadActual,
          stock_minimo: payload.stockMinimo,
        },
      });
    }
  }

  /** Plan de integración Cuadre, ítem B-2 — mismo criterio que `alBajarStock`, pero solo a Admin Total (gestionar secuencias de NCF es `admin.configuracion`, exclusivo de ese rol). */
  @OnEvent(EVENTOS.NCF_POR_AGOTARSE)
  async alAgotarseNcf(payload: NcfPorAgotarsePayload) {
    const admins = await this.prisma.user.findMany({
      where: { tenantId: payload.tenantId, roles: { some: { role: { nombre: 'Admin Total' } } } },
    });

    for (const admin of admins) {
      await this.enviar({
        tenantId: payload.tenantId,
        canal: 'EMAIL',
        clave: 'ncf_por_agotarse',
        destinatario: admin.email,
        variables: {
          tipo_ncf: payload.tipoNcf,
          restantes: String(payload.restantes),
          umbral_alerta: String(payload.umbralAlerta),
        },
      });
    }
  }

  /** Ítem H-2b (bot de WhatsApp) — calcado de `alAgotarseNcf`: solo Admin Total, mismo criterio de "acá no hay un rol más específico obvio para esto". Requiere que el tenant tenga creada la plantilla `whatsapp_requiere_atencion` (EMAIL) — sin ella, no falla, solo no envía (mismo degrade que el resto de `NotificacionPlantilla`). */
  @OnEvent(EVENTOS.WHATSAPP_REQUIERE_ATENCION)
  async alRequerirAtencionWhatsapp(payload: WhatsappRequiereAtencionPayload) {
    const admins = await this.prisma.user.findMany({
      where: { tenantId: payload.tenantId, roles: { some: { role: { nombre: 'Admin Total' } } } },
    });

    for (const admin of admins) {
      await this.enviar({
        tenantId: payload.tenantId,
        canal: 'EMAIL',
        clave: 'whatsapp_requiere_atencion',
        destinatario: admin.email,
        variables: { telefono: payload.telefono },
      });
    }
  }

  /** Fase 5b — calcado de `alBajarStock`: mismo criterio de a quién avisar, distinta clave de plantilla. */
  @OnEvent(EVENTOS.LOTE_POR_VENCER)
  async alVencerLote(payload: LotePorVencerPayload) {
    const admins = await this.prisma.user.findMany({
      where: { tenantId: payload.tenantId, roles: { some: { role: { nombre: { in: ['Admin Total', 'Almacenero'] } } } } },
    });

    for (const admin of admins) {
      await this.enviar({
        tenantId: payload.tenantId,
        canal: 'EMAIL',
        clave: 'lote_por_vencer',
        destinatario: admin.email,
        variables: {
          producto_nombre: payload.productoNombre,
          numero_lote: payload.numeroLote,
          fecha_vencimiento: payload.fechaVencimiento,
          cantidad_actual: payload.cantidadActual,
        },
      });
    }
  }

  /** Plugin de Proyectos — hito próximo a vencer (ver HitosProyectoCronService). */
  @OnEvent(EVENTOS.HITO_PROYECTO_POR_VENCER)
  async alVencerHitoProyecto(payload: HitoProyectoPorVencerPayload) {
    const destinatarios = await this.resolverDestinatariosProyecto(payload.tenantId, payload.responsableUserId);
    for (const destinatario of destinatarios) {
      await this.enviar({
        tenantId: payload.tenantId,
        canal: 'EMAIL',
        clave: 'hito_proyecto_por_vencer',
        destinatario,
        variables: {
          hito_nombre: payload.hitoNombre,
          proyecto_nombre: payload.proyectoNombre,
          fecha_objetivo: payload.fechaObjetivo,
        },
      });
    }
  }

  /** Plugin de Proyectos — costo real (horas + gastos) superó el presupuesto (ver PresupuestoProyectoListener). */
  @OnEvent(EVENTOS.PROYECTO_PRESUPUESTO_SUPERADO)
  async alSuperarPresupuestoProyecto(payload: ProyectoPresupuestoSuperadoPayload) {
    const destinatarios = await this.resolverDestinatariosProyecto(payload.tenantId, payload.responsableUserId);
    for (const destinatario of destinatarios) {
      await this.enviar({
        tenantId: payload.tenantId,
        canal: 'EMAIL',
        clave: 'proyecto_presupuesto_superado',
        destinatario,
        variables: {
          proyecto_nombre: payload.proyectoNombre,
          presupuesto: payload.presupuesto,
          costo_total: payload.costoTotal,
        },
      });
    }
  }

  /**
   * Plugin de Proyectos (Fase 8) — nuevo comentario en una tarea. A
   * diferencia de `alVencerHitoProyecto`/`alSuperarPresupuestoProyecto`
   * (un solo `responsableUserId` con fallback a Admin Total), acá puede
   * haber VARIOS responsables — el emisor (`TareasProyectoService`) ya
   * resolvió `Empleado.userId` de cada uno y excluyó al propio autor, así
   * que este listener solo busca esos `User` y les manda EMAIL siempre +
   * WHATSAPP si tienen teléfono guardado (canal compartido de Plataforma,
   * ver el comentario de `PLANTILLAS_COMENTARIOS_TAREA_BASE`). Sin
   * destinatarios (tarea sin responsables con User vinculado), no manda
   * nada — a propósito, no hay fallback a Admin Total acá: un comentario
   * de tarea no es tan crítico como un hito por vencer o un presupuesto
   * superado.
   */
  @OnEvent(EVENTOS.TAREA_PROYECTO_COMENTADA)
  async alComentarTareaProyecto(payload: TareaProyectoComentadaPayload) {
    if (payload.destinatariosUserId.length === 0) return;
    const usuarios = await this.prisma.user.findMany({ where: { id: { in: payload.destinatariosUserId } } });
    const variables = {
      autor_nombre: payload.autorNombre,
      tarea_titulo: payload.tareaTitulo,
      proyecto_nombre: payload.proyectoNombre,
      contenido: payload.contenido,
    };
    for (const usuario of usuarios) {
      await this.enviar({ tenantId: payload.tenantId, canal: 'EMAIL', clave: 'tarea_proyecto_comentario_nuevo', destinatario: usuario.email, variables });
      if (usuario.telefono) {
        await this.enviar({ tenantId: payload.tenantId, canal: 'WHATSAPP', clave: 'tarea_proyecto_comentario_nuevo', destinatario: usuario.telefono, variables });
      }
    }
  }

  /** Responsable del proyecto si tiene usuario del sistema; si no, fallback a todos los Admin Total del tenant — mismo criterio de `alBajarStock`/`alVencerLote`. */
  private async resolverDestinatariosProyecto(tenantId: string, responsableUserId: string | null): Promise<string[]> {
    if (responsableUserId) {
      const usuario = await this.prisma.user.findUnique({ where: { id: responsableUserId } });
      if (usuario) return [usuario.email];
    }
    const admins = await this.prisma.user.findMany({
      where: { tenantId, roles: { some: { role: { nombre: 'Admin Total' } } } },
    });
    return admins.map((admin) => admin.email);
  }

  /**
   * Fase 5 (Publicaciones Sociales) — a diferencia de todo lo de arriba
   * (que resuelve por `role.nombre` hardcodeado), esto va por el
   * PERMISO real `publicacionessociales.aprobar` — mismo JOIN que ya
   * usa `AutorizacionesRepository.resolverDestinatarios`. Cualquier rol
   * que tenga ese permiso avisa a sus usuarios, no solo Admin Total.
   */
  private resolverAprobadoresPublicacionesSociales(tenantId: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        activo: true,
        roles: { some: { role: { rolePermissions: { some: { permission: { clave: 'publicacionessociales.aprobar' } } } } } },
      },
    });
  }

  private enlacePublicacionesSociales(): string {
    return `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/publicaciones-sociales`;
  }

  /**
   * Fase 5 — a diferencia de `whatsAppChannel` (credenciales de
   * PLATAFORMA, un solo número para todo el SaaS), esto usa el WhatsApp
   * del TENANT (Integraciones) — mismo criterio que
   * `PublicacionesSocialesService.enviarPorWhatsapp`. Requiere además
   * un Content SID de una plantilla YA aprobada por Meta (no hay forma
   * de que el negocio inicie la conversación sin eso). Se degrada en
   * silencio si falta cualquier credencial o el SID — el email ya salió
   * por `enviar()`, nadie se queda sin enterarse.
   *
   * OJO: usa `this.prisma` (global) directo, NUNCA `WhatsappConfigRepository`
   * — este handler corre desde un `@OnEvent`, fuera de todo contexto de
   * request HTTP, y `WhatsappConfigRepository` usa `TenantPrismaService`
   * (request-scoped), que revienta con `ForbiddenException` sin
   * `request.user` (bug real encontrado probando esto en vivo).
   */
  private async enviarWhatsappAprobacionTenant(tenantId: string, telefono: string, productoNombre: string) {
    const config = await this.prisma.whatsappConfigTenant.findUnique({ where: { tenantId } });
    if (!config?.twilioAccountSid || !config.twilioAuthTokenCifrado || !config.twilioWhatsappFrom || !config.twilioTemplateAprobacionSid) {
      this.logger.warn(
        `WhatsApp de aprobación no enviado a ${telefono} — falta configurar Twilio o el Content SID de aprobación en Integraciones (tenant ${tenantId})`,
      );
      return;
    }
    const enviado = await enviarWhatsappTwilio({
      accountSid: config.twilioAccountSid,
      authToken: descifrar(config.twilioAuthTokenCifrado),
      from: `whatsapp:${config.twilioWhatsappFrom}`,
      to: telefono.replace(/^whatsapp:/, ''),
      contentSid: config.twilioTemplateAprobacionSid,
      contentVariables: { '1': productoNombre, '2': this.enlacePublicacionesSociales() },
    });
    if (!enviado) {
      this.logger.error(`Twilio respondió con error al enviar el WhatsApp de aprobación a ${telefono} (tenant ${tenantId})`);
    }
  }

  /** Avisa a TODOS los que tengan el permiso de aprobar — Email siempre, WhatsApp del negocio si el aprobador tiene teléfono y el tenant configuró el Content SID. */
  @OnEvent(EVENTOS.PUBLICACION_SOCIAL_PENDIENTE_APROBACION)
  async alQuedarPendienteAprobacionPublicacionSocial(payload: PublicacionSocialPendienteAprobacionPayload) {
    const aprobadores = await this.resolverAprobadoresPublicacionesSociales(payload.tenantId);
    for (const aprobador of aprobadores) {
      await this.enviar({
        tenantId: payload.tenantId,
        canal: 'EMAIL',
        clave: 'publicacion_social_pendiente_aprobacion',
        destinatario: aprobador.email,
        variables: { producto_nombre: payload.productoNombre, link: this.enlacePublicacionesSociales() },
      });
      if (aprobador.telefono) {
        await this.enviarWhatsappAprobacionTenant(payload.tenantId, aprobador.telefono, payload.productoNombre);
      }
    }
  }

  /** Cierra el ciclo del lado del creador — le llega el comentario textual del aprobador. */
  @OnEvent(EVENTOS.PUBLICACION_SOCIAL_CAMBIOS_SOLICITADOS)
  async alPedirCambiosPublicacionSocial(payload: PublicacionSocialCambiosSolicitadosPayload) {
    const creador = await this.prisma.user.findUnique({ where: { id: payload.creadoPorId } });
    if (!creador) return;
    await this.enviar({
      tenantId: payload.tenantId,
      canal: 'EMAIL',
      clave: 'publicacion_social_cambios_solicitados',
      destinatario: creador.email,
      variables: { producto_nombre: payload.productoNombre, comentario: payload.comentario, link: this.enlacePublicacionesSociales() },
    });
  }

  /** Avisos de cierre — informativos, sin WhatsApp con botones (no hay ninguna acción rápida que ofrecer acá). */
  @OnEvent(EVENTOS.PUBLICACION_SOCIAL_APROBADA)
  async alAprobarsePublicacionSocial(payload: PublicacionSocialAprobadaPayload) {
    const creador = await this.prisma.user.findUnique({ where: { id: payload.creadoPorId } });
    if (!creador) return;
    await this.enviar({
      tenantId: payload.tenantId,
      canal: 'EMAIL',
      clave: 'publicacion_social_aprobada',
      destinatario: creador.email,
      variables: { producto_nombre: payload.productoNombre, link: this.enlacePublicacionesSociales() },
    });
  }

  @OnEvent(EVENTOS.PUBLICACION_SOCIAL_RECHAZADA)
  async alRechazarsePublicacionSocial(payload: PublicacionSocialRechazadaPayload) {
    const creador = await this.prisma.user.findUnique({ where: { id: payload.creadoPorId } });
    if (!creador) return;
    await this.enviar({
      tenantId: payload.tenantId,
      canal: 'EMAIL',
      clave: 'publicacion_social_rechazada',
      destinatario: creador.email,
      variables: { producto_nombre: payload.productoNombre, motivo_rechazo: payload.motivoRechazo },
    });
  }
}
