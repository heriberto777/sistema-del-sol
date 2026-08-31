import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Ítem E-1 — BORRADOR→CONFIRMADO dispara el movimiento real de stock (origen→destino); BORRADOR→CANCELADO no toca nada. */
export class CambiarEstadoTransferenciaInventarioDto {
  @ApiProperty({ enum: ['CONFIRMADO', 'CANCELADO'] })
  @IsIn(['CONFIRMADO', 'CANCELADO'])
  estado: 'CONFIRMADO' | 'CANCELADO';
}
