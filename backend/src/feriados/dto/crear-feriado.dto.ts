import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CrearFeriadoDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  nombre: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  fecha: string;

  @ApiProperty({ required: false, default: true, description: 'Si se repite cada año (feriados fijos) o es puntual de esta fecha exacta.' })
  @IsOptional()
  @IsBoolean()
  recurrenteAnual?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
