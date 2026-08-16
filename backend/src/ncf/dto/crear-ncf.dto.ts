import { ApiProperty } from '@nestjs/swagger';
import { TipoNcf } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class CrearNcfDto {
  @ApiProperty({ enum: TipoNcf })
  @IsEnum(TipoNcf)
  tipoNcf: TipoNcf;

  @ApiProperty({ required: false, default: 1, description: 'Secuencia desde la que empieza a numerar' })
  @IsOptional()
  @IsInt()
  @Min(1)
  secuenciaInicial?: number;

  @ApiProperty({ description: 'Última secuencia autorizada por DGII para este rango' })
  @IsInt()
  @Min(1)
  secuenciaFinal: number;

  @ApiProperty({ description: 'Fecha de vencimiento del rango autorizado' })
  @IsDateString()
  vigenciaHasta: string;
}
