import { ApiProperty } from '@nestjs/swagger';
import { TipoNcf } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CrearNcfDto {
  @ApiProperty({ enum: TipoNcf })
  @IsEnum(TipoNcf)
  tipoNcf: TipoNcf;

  @ApiProperty({
    required: false,
    description: 'Sucursal a la que pertenece esta secuencia. Si se omite, es la secuencia COMPARTIDA por todas las sucursales del tenant (comportamiento por defecto)',
  })
  @IsOptional()
  @IsString()
  sucursalId?: string;

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

  @ApiProperty({ required: false, description: 'Si los comprobantes restantes caen a este nivel o menos, se emite un aviso' })
  @IsOptional()
  @IsInt()
  @Min(0)
  umbralAlerta?: number;
}
