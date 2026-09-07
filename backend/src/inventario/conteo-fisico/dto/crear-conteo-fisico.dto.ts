import { ApiProperty } from '@nestjs/swagger';
import { AlcanceConteoFisico } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

/** Conteo Físico vs Teórico — TOTAL trae todo el stock contable de la bodega, SELECCION solo las variantes indicadas (conteo cíclico). */
export class CrearConteoFisicoDto {
  @ApiProperty()
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ enum: AlcanceConteoFisico })
  @IsEnum(AlcanceConteoFisico)
  alcance: AlcanceConteoFisico;

  @ApiProperty({ required: false, type: [String], description: 'Obligatorio si alcance = SELECCION' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  varianteIds?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notas?: string;
}
