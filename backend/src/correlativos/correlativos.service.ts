import { Injectable } from '@nestjs/common';
import { Prisma, TipoCorrelativo } from '@prisma/client';
import { CorrelativosRepository } from './correlativos.repository';
import { ActualizarCorrelativoDto } from './dto/actualizar-correlativo.dto';

@Injectable()
export class CorrelativosService {
  constructor(private readonly correlativosRepository: CorrelativosRepository) {}

  listar() {
    return this.correlativosRepository.listar();
  }

  actualizar(tenantId: string, tipo: TipoCorrelativo, dto: ActualizarCorrelativoDto) {
    return this.correlativosRepository.actualizar(tenantId, tipo, dto);
  }

  /** Consumida por el botón "Asignar según consecutivo" en Producto/CuentaContable. */
  siguiente(tenantId: string, tipo: TipoCorrelativo) {
    return this.correlativosRepository.siguiente(tenantId, tipo);
  }

  /**
   * Variante para participar en una transacción ya abierta (ej.
   * FacturacionService.crear) — mismo patrón que
   * ProductosService.buscarPorIdEnTx/VariantesService.resolverObligatoriaEnTx.
   * Hallazgo de consistencia de la auditoría de arquitectura: antes
   * FacturacionService inyectaba CorrelativosRepository directo porque
   * este wrapper no existía.
   */
  siguienteEnTx(tx: Prisma.TransactionClient, tenantId: string, tipo: TipoCorrelativo) {
    return this.correlativosRepository.siguienteEnTx(tx, tenantId, tipo);
  }
}
