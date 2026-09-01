import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlanubeAdapter } from './alanube.adapter';
import { TipoDocumentoECf, EmisorECfLinea } from './emisor-ecf-adapter.interface';

const TIPOS_ECF: readonly string[] = ['E31', 'E32', 'E33', 'E34'];

function esTipoDocumentoECf(tipo: string | null): tipo is TipoDocumentoECf {
  return tipo !== null && TIPOS_ECF.includes(tipo);
}

/**
 * Corre fuera de un request HTTP (llamado desde EmisionECfEventosService,
 * un listener del Event Bus) — usa PrismaService global + tenantId
 * explícito, nunca TenantPrismaService (request-scoped), mismo criterio
 * que ContabilidadEventosService/NotificacionesService.
 */
@Injectable()
export class EmisionECfService {
  private readonly logger = new Logger(EmisionECfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alanubeAdapter: AlanubeAdapter,
  ) {}

  /**
   * Nunca lanza — un fallo de emisión de e-CF no debe tumbar ni
   * revertir una venta ya facturada (stock descontado, NCF consumido).
   * `factura.eCfEstado` queda en `null` si no se pudo emitir (falta
   * token, Alanube no respondió, etc.) — se puede reintentar a mano
   * después vía `consultarEstado`/reemitir.
   */
  async emitirParaFactura(tenantId: string, facturaId: string): Promise<void> {
    const factura = await this.prisma.factura.findUnique({
      where: { id: facturaId },
      include: { cliente: true, tenant: true, lineas: { include: { producto: true } } },
    });
    if (!factura || factura.tenantId !== tenantId) return;
    if (!esTipoDocumentoECf(factura.tipoNcf) || !factura.ncf) return;
    if (factura.eCfEstado) return; // ya se emitió antes — idempotencia si el evento se reprocesa

    if (!factura.tenant.rnc || !factura.tenant.direccion) {
      this.logger.warn(`Tenant ${tenantId} no tiene RNC/dirección configurados — no se puede emitir el e-CF de la factura ${facturaId}`);
      return;
    }

    const secuencia = await this.prisma.ncfAsignado.findFirst({
      where: { tenantId, tipoNcf: factura.tipoNcf },
      orderBy: { vigenciaHasta: 'desc' },
    });
    if (!secuencia) {
      this.logger.warn(`No hay NcfAsignado de ${factura.tipoNcf} para el tenant ${tenantId} — no se puede armar sequenceDueDate del e-CF`);
      return;
    }

    const lineas: EmisorECfLinea[] = factura.lineas.map((l, i) => ({
      numero: i + 1,
      descripcion: l.producto?.nombre ?? l.descripcionManual ?? 'Ítem',
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
      montoTotal: Number(l.montoTotal),
    }));

    try {
      const resultado = await this.alanubeAdapter.emitir({
        tipo: factura.tipoNcf,
        encf: factura.ncf,
        fechaVencimientoSecuencia: secuencia.vigenciaHasta,
        emisor: { rnc: factura.tenant.rnc, razonSocial: factura.tenant.nombre, direccion: factura.tenant.direccion },
        receptor: { rnc: factura.cliente.rncCedula ?? undefined, razonSocial: factura.cliente.nombre },
        lineas,
        montoTotal: Number(factura.total),
        itbisTotal: Number(factura.itbis),
      });
      await this.prisma.factura.update({
        where: { id: facturaId },
        data: { eCfEstado: 'EN_PROCESO', eCfIdExterno: resultado.idExterno },
      });
    } catch (error) {
      this.logger.warn(`No se pudo emitir el e-CF de la factura ${facturaId}: ${(error as Error).message}`);
    }
  }

  /** Refresca el estado consultando a Alanube — ver GET /facturas/:id/ecf-estado. */
  async consultarEstado(tenantId: string, facturaId: string) {
    const factura = await this.prisma.factura.findUniqueOrThrow({ where: { id: facturaId } });
    if (factura.tenantId !== tenantId) throw new NotFoundException('Factura no encontrada'); // mismo criterio IDOR que el resto del proyecto
    if (!esTipoDocumentoECf(factura.tipoNcf) || !factura.eCfIdExterno) {
      return { eCfEstado: factura.eCfEstado, eCfMensajeError: factura.eCfMensajeError };
    }

    const resultado = await this.alanubeAdapter.consultarEstado(factura.eCfIdExterno, factura.tipoNcf);
    await this.prisma.factura.update({
      where: { id: facturaId },
      data: { eCfEstado: resultado.estado, eCfMensajeError: resultado.mensaje },
    });
    return { eCfEstado: resultado.estado, eCfMensajeError: resultado.mensaje ?? null };
  }

  /** Ver AlanubeWebhookController — payload/firma sin confirmar contra documentación real de Alanube todavía (best-effort). */
  async actualizarPorWebhook(idExterno: string, estado: string, mensaje?: string) {
    const ESTADOS = ['ACEPTADO', 'ACEPTADO_CONDICIONAL', 'RECHAZADO', 'EN_PROCESO'];
    if (!ESTADOS.includes(estado)) return;
    await this.prisma.factura.updateMany({
      where: { eCfIdExterno: idExterno },
      data: { eCfEstado: estado as 'ACEPTADO' | 'ACEPTADO_CONDICIONAL' | 'RECHAZADO' | 'EN_PROCESO', eCfMensajeError: mensaje },
    });
  }
}
