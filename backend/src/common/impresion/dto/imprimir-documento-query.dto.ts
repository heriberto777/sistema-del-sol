import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { FormatoImpresion } from '@prisma/client';

/**
 * Si se omite, el backend resuelve el formato efectivo (override de
 * Bodega > default del tenant > 'CARTA') — ver resolverFormatoImpresion.
 */
export class ImprimirDocumentoQueryDto {
  @ApiProperty({ enum: FormatoImpresion, required: false })
  @IsOptional()
  @IsEnum(FormatoImpresion)
  formato?: FormatoImpresion;
}
