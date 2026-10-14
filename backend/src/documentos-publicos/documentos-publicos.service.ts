import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { mapearFacturaAParams } from '../facturacion/mapear-factura-pdf';
import { mapearCotizacionAParams } from '../cotizaciones/mapear-cotizacion-pdf';
import { generarPdfPersonalizado } from '../common/pdf/generar-documento-impreso';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { CLIENTE_SELECT_BASICO } from '../common/prisma/cliente-select-basico';
import { ResponderCotizacionDto } from './dto/responder-cotizacion.dto';

/**
 * Ítem H-4 — link público de solo lectura para que un cliente vea SU
 * Factura/Cotización desde el link que llega en el email/WhatsApp, sin
 * cuenta en el sistema. Mismo patrón que `cobros-publicos.service.ts`
 * (`PrismaService` global, no `TenantPrismaService` — el tenantId no se
 * conoce hasta después de resolver el id) — el UUID no enumerable actúa
 * como capability token implícito, sin necesidad de un token aparte.
 */
@Injectable()
export class DocumentosPublicosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  private async buscarFactura(id: string) {
    const factura = await this.prisma.factura.findUnique({
      where: { id },
      include: { cliente: { select: CLIENTE_SELECT_BASICO }, lineas: { include: { producto: true } }, recargos: { orderBy: { orden: 'asc' } } },
    });
    if (!factura) throw new NotFoundException('Factura no encontrada');
    return factura;
  }

  private async buscarCotizacion(id: string) {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: { cliente: { select: CLIENTE_SELECT_BASICO }, lineas: { include: { producto: true } } },
    });
    if (!cotizacion) throw new NotFoundException('Cotización no encontrada');
    return cotizacion;
  }

  async obtenerFactura(id: string) {
    const factura = await this.buscarFactura(id);
    const personalizacion = await resolverPersonalizacionDocumento(this.prisma, factura.tenantId, 'FACTURA');
    // El layout de bloques de la Fase C es interno del motor de PDF — esta vista pública no lo necesita (ver comentario en VerDocumentoPublico.tsx). `undefined` se cae solo al serializar a JSON.
    return { ...mapearFacturaAParams(factura), ...personalizacion, layoutPersonalizado: undefined };
  }

  async obtenerFacturaPdf(id: string) {
    const factura = await this.buscarFactura(id);
    return generarPdfPersonalizado(this.prisma, factura.tenantId, 'FACTURA', mapearFacturaAParams(factura), factura.bodegaId);
  }

  async obtenerCotizacion(id: string) {
    const cotizacion = await this.buscarCotizacion(id);
    const personalizacion = await resolverPersonalizacionDocumento(this.prisma, cotizacion.tenantId, 'COTIZACION');
    // CRM "Cotización conectada" — estado/motivoRechazo viajan acá para que
    // VerDocumentoPublico.tsx sepa si mostrar los botones Aprobar/Rechazar
    // o el aviso de que ya se respondió.
    return {
      ...mapearCotizacionAParams(cotizacion),
      ...personalizacion,
      layoutPersonalizado: undefined,
      estado: cotizacion.estado,
      motivoRechazo: cotizacion.motivoRechazo ?? undefined,
    };
  }

  async obtenerCotizacionPdf(id: string) {
    const cotizacion = await this.buscarCotizacion(id);
    return generarPdfPersonalizado(this.prisma, cotizacion.tenantId, 'COTIZACION', mapearCotizacionAParams(cotizacion));
  }

  /**
   * CRM "Cotización conectada" — el cliente aprueba/rechaza sin login.
   * ACEPTADA es el único estado realmente cerrado (mismo criterio que
   * CotizacionesService.validarQuePuedaEditarse): una vez aceptada, este
   * endpoint ya no deja volver a responder. RECHAZADA sigue abierta a que
   * el cliente cambie de opinión y apruebe después.
   */
  async responderCotizacion(id: string, dto: ResponderCotizacionDto) {
    const cotizacion = await this.buscarCotizacion(id);
    if (cotizacion.estado === 'ACEPTADA') {
      throw new BadRequestException('Esta cotización ya fue aceptada — no se puede volver a responder.');
    }
    if (dto.decision === 'RECHAZADA' && !dto.motivo?.trim()) {
      throw new BadRequestException('Contanos brevemente por qué la rechazás.');
    }

    await this.prisma.cotizacion.update({
      where: { id },
      data: { estado: dto.decision, motivoRechazo: dto.decision === 'RECHAZADA' ? dto.motivo!.trim() : null },
    });

    this.eventBus.emit(EVENTOS.COTIZACION_RESPONDIDA, {
      tenantId: cotizacion.tenantId,
      cotizacionId: id,
      vendedorId: cotizacion.vendedorId,
      clienteNombre: cotizacion.cliente.nombre,
      numero: cotizacion.numero,
      decision: dto.decision,
      motivo: dto.decision === 'RECHAZADA' ? dto.motivo!.trim() : undefined,
    });

    return { ok: true, estado: dto.decision };
  }
}
