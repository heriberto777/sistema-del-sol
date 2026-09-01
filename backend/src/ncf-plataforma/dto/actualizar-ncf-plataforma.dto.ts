import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class ActualizarNcfPlataformaDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  secuenciaFinal?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  vigenciaHasta?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ required: false, nullable: true, description: 'null para quitar la alerta' })
  @IsOptional()
  @IsInt()
  @Min(0)
  umbralAlerta?: number | null;
}
