import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Suscripcion, Plan, CanalNotificacionVencimiento } from '@prisma/client';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { ActualizarFacturaPlataformaDto } from './dto/actualizar-factura-plataforma.dto';
import { CrearFacturaPlataformaManualDto } from './dto/crear-factura-plataforma-manual.dto';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { WhatsAppChannel } from '../notificaciones/canales/whatsapp.channel';
import { PlataformaWebhookChannel } from '../plataforma-config/plataforma-webhook.channel';
import { PlataformaConfigRepository } from '../plataforma-config/plataforma-config.repository';
import { NcfPlataformaService } from '../ncf-plataforma/ncf-plataforma.service';
import { EmisionECfService } from '../emision-ecf/emision-ecf.service';
import { generarDocumentoPdf } from '../common/pdf/documento-pdf';
import { mapearFacturaPlataformaAParams } from './mapear-factura-plataforma-pdf';
import { PrismaService } from '../prisma/prisma.service';
import { SuscripcionesRepository } from './suscripciones.repository';
import { CuponesPlataformaRepository } from './cupones/cupones-plataforma.repository';
import { sumarCiclos } from './sumar-ciclo.util';

const CICLO_ES: Record<string, string> = { MENSUAL: 'mensual', ANUAL: 'anual' };
const CICLO_ES_PLURAL: Record<string, string> = { MENSUAL: 'meses', ANUAL: 'años' };

@Injectable()
export class FacturasPlataformaService {
  private readonly logger = new Logger(FacturasPlataformaService.name);

  constructor(
    private readonly facturasPlataformaRepository: FacturasPlataformaRepository,
    private readonly emailChannel: EmailChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly plataformaWebhookChannel: PlataformaWebhookChannel,
    private readonly plataformaConfigRepository: PlataformaConfigRepository,
    private readonly ncfPlataformaService: NcfPlataformaService,
    private readonly emisionECfService: EmisionECfService,
    private readonly prisma: PrismaService,
    private readonly suscripcionesRepository: SuscripcionesRepository,
    private readonly cuponesPlataformaRepository: CuponesPlataformaRepository,
  ) {}

  listar(query: Parameters<FacturasPlataformaRepository['listar']>[0]) {
    return this.facturasPlataformaRepository.listar(query);
  }

  buscarPorId(id: string) {
    return this.facturasPlataformaRepository.buscarPorId(id);
  }

  /** Ítem "dashboard de plataforma" — mismo universo que ya usa el cron para las reglas de notificación. */
  listarPendientesOVencidas() {
    return this.facturasPlataformaRepository.listarPendientesOVencidas();
  }

  /**
   * Reutilizado tanto por el cron diario (facturación recurrente) como
   * por "generar factura ahora" manual — una sola fuente de verdad para
   * cómo se arma una factura de plataforma a partir de una suscripción.
   */
  async generarDesdeSuscripcion(suscripcion: Suscripcion & { plan: Plan }) {
    const ahora = new Date();
    const periodo = ahora.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
    const monto = Number(suscripcion.plan.precio);
    const { descuento, aplicarEfectos } = await this.resolverDescuento(suscripcion, monto);
    const subtotalNeto = monto - descuento;
    const [asignacionNcf, itbis] = await Promise.all([this.ncfPlataformaService.asignarSiguiente(), this.calcularItbis(subtotalNeto)]);

    const factura = await this.facturasPlataformaRepository.crear({
      tenantId: suscripcion.tenantId,
      suscripcionId: suscripcion.id,
      concepto: `Suscripción ${suscripcion.plan.nombre} (${CICLO_ES[suscripcion.plan.cicloFacturacion] ?? suscripcion.plan.cicloFacturacion}) — ${periodo}`,
      monto,
      descuento,
      itbis,
      total: subtotalNeto + itbis,
      // Vence el mismo día que se emite (sin período de gracia) — el
      // admin puede moverla con PATCH si hace falta dar más plazo.
      fechaEmision: ahora,
      fechaVencimiento: ahora,
      ...(asignacionNcf ?? {}),
    });

    await aplicarEfectos();
    await this.emisionECfService.emitirParaFacturaPlataforma(factura.id);
    await this.notificarFactura(suscripcion.tenantId, factura.id, 'generada');
    return factura;
  }

  /**
   * Resuelve el descuento de la PRÓXIMA factura automática de una
   * suscripción — "primer período gratis" manda sobre un cupón activo
   * (si ambos aplican a la vez, el gratis es el que se ve, el cupón
   * sigue esperando para el período siguiente). `aplicarEfectos` es
   * side-effect diferido a propósito: recién se ejecuta si la factura
   * se creó bien (apagar el flag/decrementar el cupón antes de crear la
   * factura, y que la creación falle después, dejaría el descuento
   * "gastado" sin ninguna factura que lo refleje).
   */
  private async resolverDescuento(
    suscripcion: Suscripcion,
    monto: number,
  ): Promise<{ descuento: number; aplicarEfectos: () => Promise<void> }> {
    if (suscripcion.primerPeriodoGratis) {
      return {
        descuento: monto,
        aplicarEfectos: async () => {
          await this.suscripcionesRepository.desactivarPrimerPeriodoGratis(suscripcion.id);
        },
      };
    }

    const aplicacion = await this.cuponesPlataformaRepository.buscarAplicacionActiva(suscripcion.id);
    if (!aplicacion) {
      return { descuento: 0, aplicarEfectos: async () => {} };
    }

    const descuento =
      aplicacion.cupon.tipo === 'PORCENTAJE'
        ? Math.round(monto * (Number(aplicacion.cupon.valor) / 100) * 100) / 100
        : Math.min(monto, Number(aplicacion.cupon.valor));

    return {
      descuento,
      aplicarEfectos: async () => {
        if (aplicacion.ciclosRestantes === null) return; // indefinido — nunca se decrementa, se quita a mano
        const restantes = aplicacion.ciclosRestantes - 1;
        if (restantes <= 0) {
          await this.cuponesPlataformaRepository.desactivarAplicacion(aplicacion.id);
        } else {
          await this.cuponesPlataformaRepository.decrementarCiclos(aplicacion.id, restantes);
        }
      },
    };
  }

  /**
   * Pago adelantado — el tenant paga N ciclos (meses/años) de una sola
   * vez. Una única factura por precio×N (sin descuento de "primer
   * período gratis" ni cupón — es un cargo puntual negociado aparte, no
   * el ciclo automático), y adelanta `fechaProximoCorte` esa misma
   * cantidad de ciclos para que el cron no vuelva a facturar hasta que
   * el período pagado termine (mismo campo que ya lee el cron todos los
   * días — no hace falta tocar notificaciones ni el resto del flujo).
   */
  async generarFacturaAdelantada(suscripcion: Suscripcion & { plan: Plan }, ciclos: number) {
    if (ciclos < 1) throw new BadRequestException('La cantidad de ciclos debe ser al menos 1');

    const ahora = new Date();
    const monto = Number(suscripcion.plan.precio) * ciclos;
    const etiquetaCiclo = ciclos === 1 ? CICLO_ES[suscripcion.plan.cicloFacturacion] : CICLO_ES_PLURAL[suscripcion.plan.cicloFacturacion];
    const [asignacionNcf, itbis] = await Promise.all([this.ncfPlataformaService.asignarSiguiente(), this.calcularItbis(monto)]);

    const factura = await this.facturasPlataformaRepository.crear({
      tenantId: suscripcion.tenantId,
      suscripcionId: suscripcion.id,
      concepto: `Suscripción ${suscripcion.plan.nombre} — pago adelantado (${ciclos} ${etiquetaCiclo ?? suscripcion.plan.cicloFacturacion})`,
      monto,
      itbis,
      total: monto + itbis,
      fechaEmision: ahora,
      fechaVencimiento: ahora,
      ...(asignacionNcf ?? {}),
    });

    await this.suscripcionesRepository.avanzarProximoCorte(
      suscripcion.id,
      sumarCiclos(suscripcion.fechaProximoCorte, suscripcion.plan.cicloFacturacion, ciclos),
    );
    await this.emisionECfService.emitirParaFacturaPlataforma(factura.id);
    await this.notificarFactura(suscripcion.tenantId, factura.id, 'manual');
    return factura;
  }

  /** Cargo puntual fuera del ciclo de suscripción, con líneas múltiples — ver PlatformFacturas.tsx "Nueva factura". */
  async crearManual(dto: CrearFacturaPlataformaManualDto) {
    const suscripcion = await this.prisma.suscripcion.findUnique({ where: { tenantId: dto.tenantId } });
    if (!suscripcion) {
      throw new BadRequestException('Este tenant no tiene una suscripción — no se puede facturar manualmente');
    }

    const monto = dto.lineas.reduce((acc, l) => acc + l.monto, 0);
    const ahora = new Date();
    const concepto = dto.lineas.length === 1 ? dto.lineas[0].concepto : `${dto.lineas[0].concepto} (+${dto.lineas.length - 1} más)`;
    const [asignacionNcf, itbis] = await Promise.all([this.ncfPlataformaService.asignarSiguiente(), this.calcularItbis(monto)]);

    const factura = await this.facturasPlataformaRepository.crear({
      tenantId: dto.tenantId,
      suscripcionId: suscripcion.id,
      concepto,
      monto,
      itbis,
      total: monto + itbis,
      fechaEmision: ahora,
      fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : ahora,
      lineas: dto.lineas,
      ...(asignacionNcf ?? {}),
    });

    await this.emisionECfService.emitirParaFacturaPlataforma(factura.id);
    await this.notificarFactura(dto.tenantId, factura.id, 'manual');
    return factura;
  }

  async actualizar(id: string, dto: ActualizarFacturaPlataformaDto) {
    const factura = await this.facturasPlataformaRepository.buscarPorId(id);
    if (factura.estado === 'PAGADA' || factura.estado === 'ANULADA') {
      throw new BadRequestException(`No se puede editar una factura ${factura.estado.toLowerCase()}`);
    }

    const monto = Number(factura.monto);
    const descuento = dto.descuento ?? Number(factura.descuento);
    const montoMora = dto.montoMora ?? Number(factura.montoMora);
    const subtotalNeto = monto - descuento;
    // Forward-only: una factura vieja (itbis=0, de antes de esta pieza)
    // nunca gana ITBIS retroactivo solo por editarle el descuento — solo
    // se recalcula si YA tenía ITBIS al crearse.
    const itbis = Number(factura.itbis) > 0 ? await this.calcularItbis(subtotalNeto) : 0;
    const total = subtotalNeto + itbis + montoMora;
    if (total < 0) {
      throw new BadRequestException('El descuento no puede superar el monto + la mora');
    }

    return this.facturasPlataformaRepository.actualizar(id, {
      concepto: dto.concepto,
      descuento: dto.descuento,
      montoMora: dto.montoMora,
      itbis,
      total,
      fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : undefined,
    });
  }

  /** Ítem "ITBIS en la facturación SaaS" — % global de plataforma, 0 = sin ITBIS. Nunca aplica sobre la mora. */
  private async calcularItbis(base: number) {
    const config = await this.plataformaConfigRepository.obtenerOCrear();
    return Math.round(base * (Number(config.porcentajeItbis) / 100) * 100) / 100;
  }

  async anular(id: string) {
    const factura = await this.facturasPlataformaRepository.buscarPorId(id);
    if (factura.estado === 'PAGADA') {
      throw new BadRequestException('No se puede anular una factura ya pagada');
    }
    if (factura.estado === 'ANULADA') {
      throw new BadRequestException('Esa factura ya estaba anulada');
    }
    const pagos = await this.facturasPlataformaRepository.contarPagos(id);
    if (pagos > 0) {
      throw new BadRequestException('No se puede anular una factura con pagos parciales registrados');
    }
    return this.facturasPlataformaRepository.marcarEstado(id, 'ANULADA');
  }

  async generarPdf(id: string) {
    const [factura, config] = await Promise.all([this.facturasPlataformaRepository.buscarPorId(id), this.plataformaConfigRepository.obtenerOCrear()]);
    const emisor = config.nombreNegocio
      ? { nombre: config.nombreNegocio, rnc: config.rnc ?? undefined, direccion: config.direccion ?? undefined, telefono: config.telefono ?? undefined }
      : undefined;
    return generarDocumentoPdf(mapearFacturaPlataformaAParams(factura, emisor));
  }

  async marcarPagada(id: string, fechaPago: Date) {
    return this.facturasPlataformaRepository.marcarEstado(id, 'PAGADA', fechaPago);
  }

  async marcarVencidaConMora(id: string, feeMoraPct: number) {
    const factura = await this.facturasPlataformaRepository.buscarPorId(id);
    const montoMora = Math.round(Number(factura.total) * (feeMoraPct / 100) * 100) / 100;
    const total = Number(factura.total) + montoMora;
    await this.facturasPlataformaRepository.actualizar(id, { montoMora, total });
    await this.facturasPlataformaRepository.marcarEstado(id, 'VENCIDA');
    await this.notificarFactura(factura.tenantId, id, 'vencida');
  }

  /**
   * Fase 4 — despacho de un aviso configurable (ReglaNotificacionVencimiento)
   * para UNA factura. El canal EMAIL reusa el mismo destinatario/mecanismo
   * que `notificarFactura` (Admin Total más antiguo, HTML inline); WEBHOOK
   * delega en `PlataformaWebhookChannel` (URL/secret ya configurados en
   * /plataforma/configuracion). Llamado desde
   * FacturasPlataformaCronService.enviarNotificacionesVencimiento, una vez
   * por (factura, regla) que matchee la fecha de hoy.
   */
  async notificarPorRegla(facturaId: string, offsetDias: number, canal: CanalNotificacionVencimiento) {
    const factura = await this.facturasPlataformaRepository.buscarPorId(facturaId);
    const payload = {
      facturaId: factura.id,
      tenantId: factura.tenantId,
      concepto: factura.concepto,
      total: factura.total.toString(),
      fechaVencimiento: factura.fechaVencimiento.toISOString(),
      offsetDias,
    };

    if (canal === 'WEBHOOK') {
      await this.plataformaWebhookChannel.enviar(payload);
      return;
    }

    const enlacePago = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/pagar/${factura.id}`;
    const porVencer = offsetDias < 0;

    if (canal === 'WHATSAPP') {
      // Va al teléfono de la EMPRESA (Tenant.telefono) — no hay teléfono
      // por usuario individual, decisión confirmada con el usuario.
      const tenant = await this.prisma.tenant.findUnique({ where: { id: factura.tenantId }, select: { telefono: true } });
      if (!tenant?.telefono) {
        this.logger.warn(`Tenant ${factura.tenantId} sin teléfono configurado — no se pudo enviar el aviso de vencimiento por WhatsApp de la factura ${facturaId}`);
        return;
      }
      const mensaje = `${porVencer ? 'Tu factura está por vencer' : 'Tu factura sigue vencida'}: ${factura.concepto}. Total: RD$ ${Number(factura.total).toLocaleString('es-DO')}, vence el ${factura.fechaVencimiento.toLocaleDateString('es-DO')}. Pagar en línea: ${enlacePago}`;
      await this.whatsAppChannel.enviar(tenant.telefono, '', mensaje);
      return;
    }

    const admin = await this.prisma.user.findFirst({
      where: { tenantId: factura.tenantId, roles: { some: { role: { nombre: 'Admin Total' } } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) {
      this.logger.warn(`Sin usuario Admin Total en tenant ${factura.tenantId} — no se pudo enviar el aviso de vencimiento de la factura ${facturaId}`);
      return;
    }

    const asunto = porVencer ? 'Tu factura está por vencer — El Sistema del Sol' : 'Tu factura sigue vencida — El Sistema del Sol';
    const cuerpo = `<p>Factura: <strong>${factura.concepto}</strong>.</p><p>Total: RD$ ${Number(factura.total).toLocaleString('es-DO')} — vence el ${factura.fechaVencimiento.toLocaleDateString('es-DO')}.</p><p><a href="${enlacePago}">Pagar en línea</a></p>`;
    await this.emailChannel.enviar(admin.email, asunto, cuerpo);
  }

  /** Igual criterio que PlatformAuthService.olvidePassword: HTML inline, sin plantillas por-tenant (eso es NotificacionesService, tenant-scoped). */
  async notificarFactura(tenantId: string, facturaId: string, motivo: 'generada' | 'vencida' | 'manual' | 'auto_suspendido') {
    const admin = await this.prisma.user.findFirst({
      where: { tenantId, roles: { some: { role: { nombre: 'Admin Total' } } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) {
      this.logger.warn(`Sin usuario Admin Total en tenant ${tenantId} — no se pudo notificar la factura ${facturaId}`);
      return;
    }

    const factura = await this.facturasPlataformaRepository.buscarPorId(facturaId);
    const enlacePago = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/pagar/${factura.id}`;
    const ASUNTOS: Record<typeof motivo, string> = {
      generada: 'Nueva factura de tu suscripción — El Sistema del Sol',
      vencida: 'Factura vencida — El Sistema del Sol',
      manual: 'Nuevo cargo — El Sistema del Sol',
      auto_suspendido: 'Tu cuenta fue suspendida por falta de pago — El Sistema del Sol',
    };
    const CUERPOS: Record<typeof motivo, string> = {
      generada: `<p>Se generó una nueva factura por tu suscripción: <strong>${factura.concepto}</strong>.</p><p>Total: RD$ ${Number(factura.total).toLocaleString('es-DO')}, vence el ${factura.fechaVencimiento.toLocaleDateString('es-DO')}.</p><p><a href="${enlacePago}">Pagar en línea</a></p>`,
      vencida: `<p>Tu factura <strong>${factura.concepto}</strong> venció sin pago registrado y se le aplicó un cargo por mora.</p><p>Nuevo total: RD$ ${Number(factura.total).toLocaleString('es-DO')}.</p><p><a href="${enlacePago}">Pagar en línea</a></p>`,
      manual: `<p>Se generó un cargo puntual: <strong>${factura.concepto}</strong>.</p><p>Total: RD$ ${Number(factura.total).toLocaleString('es-DO')}, vence el ${factura.fechaVencimiento.toLocaleDateString('es-DO')}.</p><p><a href="${enlacePago}">Pagar en línea</a></p>`,
      auto_suspendido: `<p>Tu cuenta fue suspendida automáticamente por tener la factura <strong>${factura.concepto}</strong> vencida sin pago registrado.</p><p>Total pendiente: RD$ ${Number(factura.total).toLocaleString('es-DO')}.</p><p><a href="${enlacePago}">Pagar en línea para reactivar</a></p>`,
    };
    const asunto = ASUNTOS[motivo];
    const cuerpo = CUERPOS[motivo];

    this.logger.debug(`Notificación de factura ${motivo} para ${admin.email}: ${factura.id}`);
    await this.emailChannel.enviar(admin.email, asunto, cuerpo);
  }
}
