import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mapearFacturaAParams } from '../facturacion/mapear-factura-pdf';
import { mapearCotizacionAParams } from '../cotizaciones/mapear-cotizacion-pdf';
import { generarDocumentoPdf } from '../common/pdf/documento-pdf';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { resolverPlantillaDocumento } from '../common/impresion/resolver-plantilla-documento';
import { CLIENTE_SELECT_BASICO } from '../common/prisma/cliente-select-basico';

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
    const personalizacion = await resolverPersonalizacionDocumento(this.prisma, factura.tenantId);
    return { ...mapearFacturaAParams(factura), ...personalizacion };
  }

  async obtenerFacturaPdf(id: string) {
    const factura = await this.buscarFactura(id);
    const [personalizacion, plantilla] = await Promise.all([
      resolverPersonalizacionDocumento(this.prisma, factura.tenantId),
      resolverPlantillaDocumento(this.prisma, factura.tenantId, factura.bodegaId),
    ]);
    return generarDocumentoPdf({ ...mapearFacturaAParams(factura), ...personalizacion }, { plantilla });
  }

  async obtenerCotizacion(id: string) {
    const cotizacion = await this.buscarCotizacion(id);
    const personalizacion = await resolverPersonalizacionDocumento(this.prisma, cotizacion.tenantId);
    return { ...mapearCotizacionAParams(cotizacion), ...personalizacion };
  }

  async obtenerCotizacionPdf(id: string) {
    const cotizacion = await this.buscarCotizacion(id);
    const [personalizacion, plantilla] = await Promise.all([
      resolverPersonalizacionDocumento(this.prisma, cotizacion.tenantId),
      resolverPlantillaDocumento(this.prisma, cotizacion.tenantId, null),
    ]);
    return generarDocumentoPdf({ ...mapearCotizacionAParams(cotizacion), ...personalizacion }, { plantilla });
  }
}
