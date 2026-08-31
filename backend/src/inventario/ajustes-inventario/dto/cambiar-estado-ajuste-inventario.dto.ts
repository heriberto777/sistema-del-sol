import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/** Ítem E-1 — BORRADOR→CONFIRMADO dispara el movimiento real de stock; BORRADOR→CANCELADO no toca nada. */
export class CambiarEstadoAjusteInventarioDto {
  @ApiProperty({ enum: ['CONFIRMADO', 'CANCELADO'] })
  @IsIn(['CONFIRMADO', 'CANCELADO'])
  estado: 'CONFIRMADO' | 'CANCELADO';

  @ApiProperty({ required: false, description: 'Requerido solo si el usuario tiene PIN configurado (Fase 9) y alguna línea tiene cantidad negativa (salida/merma)' })
  @IsOptional()
  @IsString()
  pin?: string;
}
