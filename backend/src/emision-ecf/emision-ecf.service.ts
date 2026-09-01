import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlataformaConfigRepository } from '../plataforma-config/plataforma-config.repository';
import { AlanubeAdapter } from './alanube.adapter';
import { TipoDocumentoECf, EmisorECfLinea } from './emisor-ecf-adapter.interface';

const TIPOS_ECF: readonly string[] = ['E31', 'E32', 'E33', 'E34'];

function esTipoDocumentoECf(tipo: string | null): tipo is TipoDocumentoECf {
  return tipo !== null && TIPOS_ECF.includes(tipo);
}

/**
 * Compartido entre Facturación de tenant (pieza 2, llamado desde
 * EmisionECfEventosService vía Event Bus) y Facturación de plataforma
 * (pieza 3, llamado directo desde FacturasPlataformaService — la
 * plataforma no tiene Event Bus propio, es un flujo de cron/manual).
 * Corre fuera de un request HTTP — usa PrismaService global +
 * tenantId explícito, nunca TenantPrismaService (request-scoped),
 * mismo criterio que ContabilidadEventosService/NotificacionesService.
 */
@Injectable()
export class EmisionECfService {
  private readonly logger = new Logger(EmisionECfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alanubeAdapter: AlanubeAdapter,
    private readonly plataformaConfigRepository: PlataformaConfigRepository,
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

  /**
   * Ítem "e-CF real" (pieza 3) — mismo flujo que emitirParaFactura,
   * para lo que la plataforma le cobra a cada tenant. Llamado directo
   * desde FacturasPlataformaService (sin Event Bus, no aplica acá) al
   * final de generarDesdeSuscripcion()/crearManual(), después de que
   * NcfPlataformaService ya asignó el NCF. Solo E31 (Crédito Fiscal) —
   * la plataforma nunca emite Consumo/Notas de Crédito/Débito hacia
   * un tenant. Mapeo calcado de mapear-factura-plataforma-pdf.ts.
   */
  async emitirParaFacturaPlataforma(facturaPlataformaId: string): Promise<void> {
    const factura = await this.prisma.facturaPlataforma.findUnique({
      where: { id: facturaPlataformaId },
      include: { tenant: true, lineas: { orderBy: { orden: 'asc' } } },
    });
    if (!factura) return;
    if (factura.tipoNcf !== 'E31' || !factura.ncf) return;
    if (factura.eCfEstado) return;

    const config = await this.plataformaConfigRepository.obtenerOCrear();
    if (!config.rnc || !config.direccion || !config.nombreNegocio) {
      this.logger.warn(`Faltan datos de la empresa emisora en /plataforma/configuracion — no se puede emitir el e-CF de la factura de plataforma ${facturaPlataformaId}`);
      return;
    }

    const secuencia = await this.prisma.ncfPlataforma.findFirst({ where: { tipoNcf: 'E31' }, orderBy: { vigenciaHasta: 'desc' } });
    if (!secuencia) {
      this.logger.warn(`No hay NcfPlataforma de E31 — no se puede armar sequenceDueDate del e-CF de la factura de plataforma ${facturaPlataformaId}`);
      return;
    }

    const lineas: EmisorECfLinea[] =
      factura.lineas.length > 0
        ? factura.lineas.map((l, i) => ({ numero: i + 1, descripcion: l.concepto, cantidad: 1, precioUnitario: Number(l.monto), montoTotal: Number(l.monto) }))
        : [{ numero: 1, descripcion: factura.concepto, cantidad: 1, precioUnitario: Number(factura.monto), montoTotal: Number(factura.monto) }];

    try {
      const resultado = await this.alanubeAdapter.emitir({
        tipo: 'E31',
        encf: factura.ncf,
        fechaVencimientoSecuencia: secuencia.vigenciaHasta,
        emisor: { rnc: config.rnc, razonSocial: config.nombreNegocio, direccion: config.direccion },
        receptor: { rnc: factura.tenant.rnc ?? undefined, razonSocial: factura.tenant.nombre },
        lineas,
        montoTotal: Number(factura.total),
        itbisTotal: Number(factura.itbis),
      });
      await this.prisma.facturaPlataforma.update({
        where: { id: facturaPlataformaId },
        data: { eCfEstado: 'EN_PROCESO', eCfIdExterno: resultado.idExterno },
      });
    } catch (error) {
      this.logger.warn(`No se pudo emitir el e-CF de la factura de plataforma ${facturaPlataformaId}: ${(error as Error).message}`);
    }
  }

  /** Sin scoping de tenant — lo llama un endpoint de plataforma, ya protegido por PlatformPermissionsGuard. */
  async consultarEstadoPlataforma(facturaPlataformaId: string) {
    const factura = await this.prisma.facturaPlataforma.findUniqueOrThrow({ where: { id: facturaPlataformaId } });
    if (factura.tipoNcf !== 'E31' || !factura.eCfIdExterno) {
      return { eCfEstado: factura.eCfEstado, eCfMensajeError: factura.eCfMensajeError };
    }

    const resultado = await this.alanubeAdapter.consultarEstado(factura.eCfIdExterno, 'E31');
    await this.prisma.facturaPlataforma.update({
      where: { id: facturaPlataformaId },
      data: { eCfEstado: resultado.estado, eCfMensajeError: resultado.mensaje },
    });
    return { eCfEstado: resultado.estado, eCfMensajeError: resultado.mensaje ?? null };
  }

  /** Ver AlanubeWebhookController — payload/firma sin confirmar contra documentación real de Alanube todavía (best-effort). */
  async actualizarPorWebhook(idExterno: string, estado: string, mensaje?: string) {
    const ESTADOS = ['ACEPTADO', 'ACEPTADO_CONDICIONAL', 'RECHAZADO', 'EN_PROCESO'];
    if (!ESTADOS.includes(estado)) return;
    const data = { eCfEstado: estado as 'ACEPTADO' | 'ACEPTADO_CONDICIONAL' | 'RECHAZADO' | 'EN_PROCESO', eCfMensajeError: mensaje };
    // El id externo es único de Alanube — a lo sumo una de las dos tablas tendrá una fila con ese id, la otra es un no-op.
    await Promise.all([
      this.prisma.factura.updateMany({ where: { eCfIdExterno: idExterno }, data }),
      this.prisma.facturaPlataforma.updateMany({ where: { eCfIdExterno: idExterno }, data }),
    ]);
  }
}
