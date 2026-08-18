import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { FormatoImpresion } from '@prisma/client';

/**
 * Solo el override de formato de impresión — editar nombre/dirección/
 * activa queda fuera de alcance (no pedido, ver plan de impresión
 * multi-formato). null = quitar el override, heredar el default del tenant.
 */
export class ActualizarBodegaDto {
  @ApiProperty({ enum: FormatoImpresion, required: false, nullable: true })
  @IsOptional()
  @IsEnum(FormatoImpresion)
  formatoImpresion?: FormatoImpresion | null;
}
