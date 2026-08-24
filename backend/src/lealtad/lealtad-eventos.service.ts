import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LealtadService } from './lealtad.service';
import { EVENTOS, FacturaCreadaPayload } from '../event-bus/events';

/**
 * Reactor de eventos de negocio -> puntos de lealtad (ítem A-3), mismo
 * criterio que ComisionesEventosService/ContabilidadEventosService:
 * corre fuera de un request HTTP, un fallo acá nunca debe tumbar la
 * venta que ya se facturó — solo se loguea.
 */
@Injectable()
export class LealtadEventosService {
  private readonly logger = new Logger(LealtadEventosService.name);

  constructor(private readonly lealtadService: LealtadService) {}

  @OnEvent(EVENTOS.FACTURA_CREADA)
  async alFacturarse(payload: FacturaCreadaPayload) {
    try {
      await this.lealtadService.generarDesdeFactura({
        tenantId: payload.tenantId,
        facturaId: payload.facturaId,
        clienteId: payload.clienteId,
        tipoFactura: payload.tipoFactura,
      });
    } catch (error) {
      this.logger.error(`No se pudieron acumular los puntos de la factura ${payload.facturaId}`, error as Error);
    }
  }

  @OnEvent(EVENTOS.FACTURA_ANULADA)
  async alAnularFactura(payload: FacturaCreadaPayload) {
    try {
      await this.lealtadService.anularPorFactura(payload.tenantId, payload.facturaId);
    } catch (error) {
      this.logger.error(`No se pudo revertir los puntos de la factura ${payload.facturaId}`, error as Error);
    }
  }
}
