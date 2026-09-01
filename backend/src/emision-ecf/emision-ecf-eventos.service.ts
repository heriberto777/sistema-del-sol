import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTOS, FacturaCreadaPayload } from '../event-bus/events';
import { EmisionECfService } from './emision-ecf.service';

/**
 * Reactor de EVENTOS.FACTURA_CREADA -> emisión real de e-CF, mismo
 * criterio de desacople que ContabilidadEventosService (Facturación no
 * sabe que esto existe). El payload del evento no trae todo lo
 * necesario (líneas, cliente, datos del tenant) — EmisionECfService
 * recarga la Factura completa por id.
 */
@Injectable()
export class EmisionECfEventosService {
  private readonly logger = new Logger(EmisionECfEventosService.name);

  constructor(private readonly emisionECfService: EmisionECfService) {}

  @OnEvent(EVENTOS.FACTURA_CREADA)
  async alFacturarse(payload: FacturaCreadaPayload) {
    try {
      await this.emisionECfService.emitirParaFactura(payload.tenantId, payload.facturaId);
    } catch (error) {
      // Nunca debe tumbar la venta — ya se facturó y se movió inventario.
      this.logger.error(`No se pudo procesar la emisión de e-CF de la factura ${payload.facturaId}`, error as Error);
    }
  }
}
