import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mapearFacturaAParams } from '../facturacion/mapear-factura-pdf';
import { mapearCotizacionAParams } from '../cotizaciones/mapear-cotizacion-pdf';
import { generarDocumentoPdf } from '../common/pdf/documento-pdf';

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
  constructor(private readonly prisma: PrismaService) {}

  private async buscarFactura(id: string) {
    const factura = await this.prisma.factura.findUnique({
      where: { id },
      include: { cliente: true, lineas: { include: { producto: true } }, recargos: { orderBy: { orden: 'asc' } } },
    });
    if (!factura) throw new NotFoundException('Factura no encontrada');
    return factura;
  }

  private async buscarCotizacion(id: string) {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: { cliente: true, lineas: { include: { producto: true } } },
    });
    if (!cotizacion) throw new NotFoundException('Cotización no encontrada');
    return cotizacion;
  }

  async obtenerFactura(id: string) {
    return mapearFacturaAParams(await this.buscarFactura(id));
  }

  async obtenerFacturaPdf(id: string) {
    return generarDocumentoPdf(mapearFacturaAParams(await this.buscarFactura(id)));
  }

  async obtenerCotizacion(id: string) {
    return mapearCotizacionAParams(await this.buscarCotizacion(id));
  }

  async obtenerCotizacionPdf(id: string) {
    return generarDocumentoPdf(mapearCotizacionAParams(await this.buscarCotizacion(id)));
  }
}
