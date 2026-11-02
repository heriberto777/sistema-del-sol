import { ApiProperty } from '@nestjs/swagger';
import { TipoGestionCobro } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CrearGestionCobroDto {
  @ApiProperty()
  @IsString()
  facturaId: string;

  @ApiProperty({ enum: TipoGestionCobro })
  @IsEnum(TipoGestionCobro)
  tipo: TipoGestionCobro;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  resultado: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  promesaFecha?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  promesaMonto?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  proximaAccion?: string;
}
