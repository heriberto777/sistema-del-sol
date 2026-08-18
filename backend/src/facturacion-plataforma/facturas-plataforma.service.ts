import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Suscripcion, Plan } from '@prisma/client';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { ActualizarFacturaPlataformaDto } from './dto/actualizar-factura-plataforma.dto';
import { CrearFacturaPlataformaManualDto } from './dto/crear-factura-plataforma-manual.dto';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { PrismaService } from '../prisma/prisma.service';

const CICLO_ES: Record<string, string> = { MENSUAL: 'mensual', ANUAL: 'anual' };

@Injectable()
export class FacturasPlataformaService {
  private readonly logger = new Logger(FacturasPlataformaService.name);

  constructor(
    private readonly facturasPlataformaRepository: FacturasPlataformaRepository,
    private readonly emailChannel: EmailChannel,
    private readonly prisma: PrismaService,
  ) {}

  listar(query: Parameters<FacturasPlataformaRepository['listar']>[0]) {
    return this.facturasPlataformaRepository.listar(query);
  }

  buscarPorId(id: string) {
    return this.facturasPlataformaRepository.buscarPorId(id);
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

    const factura = await this.facturasPlataformaRepository.crear({
      tenantId: suscripcion.tenantId,
      suscripcionId: suscripcion.id,
      concepto: `Suscripción ${suscripcion.plan.nombre} (${CICLO_ES[suscripcion.plan.cicloFacturacion] ?? suscripcion.plan.cicloFacturacion}) — ${periodo}`,
      monto,
      total: monto,
      // Vence el mismo día que se emite (sin período de gracia) — el
      // admin puede moverla con PATCH si hace falta dar más plazo.
      fechaEmision: ahora,
      fechaVencimiento: ahora,
    });

    await this.notificarFactura(suscripcion.tenantId, factura.id, 'generada');
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

    const factura = await this.facturasPlataformaRepository.crear({
      tenantId: dto.tenantId,
      suscripcionId: suscripcion.id,
      concepto,
      monto,
      total: monto,
      fechaEmision: ahora,
      fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : ahora,
      lineas: dto.lineas,
    });

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
    const total = monto - descuento + montoMora;
    if (total < 0) {
      throw new BadRequestException('El descuento no puede superar el monto + la mora');
    }

    return this.facturasPlataformaRepository.actualizar(id, {
      concepto: dto.concepto,
      descuento: dto.descuento,
      montoMora: dto.montoMora,
      total,
      fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : undefined,
    });
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

  /** Igual criterio que PlatformAuthService.olvidePassword: HTML inline, sin plantillas por-tenant (eso es NotificacionesService, tenant-scoped). */
  private async notificarFactura(tenantId: string, facturaId: string, motivo: 'generada' | 'vencida' | 'manual') {
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
    };
    const CUERPOS: Record<typeof motivo, string> = {
      generada: `<p>Se generó una nueva factura por tu suscripción: <strong>${factura.concepto}</strong>.</p><p>Total: RD$ ${Number(factura.total).toLocaleString('es-DO')}, vence el ${factura.fechaVencimiento.toLocaleDateString('es-DO')}.</p><p><a href="${enlacePago}">Pagar en línea</a></p>`,
      vencida: `<p>Tu factura <strong>${factura.concepto}</strong> venció sin pago registrado y se le aplicó un cargo por mora.</p><p>Nuevo total: RD$ ${Number(factura.total).toLocaleString('es-DO')}.</p><p><a href="${enlacePago}">Pagar en línea</a></p>`,
      manual: `<p>Se generó un cargo puntual: <strong>${factura.concepto}</strong>.</p><p>Total: RD$ ${Number(factura.total).toLocaleString('es-DO')}, vence el ${factura.fechaVencimiento.toLocaleDateString('es-DO')}.</p><p><a href="${enlacePago}">Pagar en línea</a></p>`,
    };
    const asunto = ASUNTOS[motivo];
    const cuerpo = CUERPOS[motivo];

    this.logger.debug(`Notificación de factura ${motivo} para ${admin.email}: ${factura.id}`);
    await this.emailChannel.enviar(admin.email, asunto, cuerpo);
  }
}
