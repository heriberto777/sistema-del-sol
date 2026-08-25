import { Injectable } from '@nestjs/common';
import { TipoCorrelativo } from '@prisma/client';
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
}
