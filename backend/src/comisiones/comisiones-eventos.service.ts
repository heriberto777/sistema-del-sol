import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ComisionesService } from './comisiones.service';
import { EVENTOS, FacturaCreadaPayload } from '../event-bus/events';

/**
 * Reactor de eventos de negocio -> comisiones de venta (ítem A-1), mismo
 * criterio que `ContabilidadEventosService`: corre fuera de un request
 * HTTP (`ComisionesRepository` usa `PrismaService` global + `tenantId`
 * explícito para escribir), y un fallo acá nunca debe tumbar la venta que
 * ya se facturó — solo se loguea.
 */
@Injectable()
export class ComisionesEventosService {
  private readonly logger = new Logger(ComisionesEventosService.name);

  constructor(private readonly comisionesService: ComisionesService) {}

  @OnEvent(EVENTOS.FACTURA_CREADA)
  async alFacturarse(payload: FacturaCreadaPayload) {
    try {
      await this.comisionesService.generarDesdeFactura({
        tenantId: payload.tenantId,
        facturaId: payload.facturaId,
        vendedorEmpleadoId: payload.vendedorEmpleadoId ?? null,
        tipoFactura: payload.tipoFactura,
      });
    } catch (error) {
      this.logger.error(`No se pudo generar la comisión de la factura ${payload.facturaId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.FACTURA_ANULADA)
  async alAnularFactura(payload: FacturaCreadaPayload) {
    try {
      await this.comisionesService.anularPorFactura(payload.tenantId, payload.facturaId);
    } catch (error) {
      this.logger.error(`No se pudo anular la comisión de la factura ${payload.facturaId}`, error as Error);
    }
  }
}
