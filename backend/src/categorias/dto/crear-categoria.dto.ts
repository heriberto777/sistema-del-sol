import { ColorCategoria } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CrearCategoriaDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsOptional()
  @IsUUID()
  categoriaPadreId?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  @IsEnum(ColorCategoria)
  color?: ColorCategoria;
}
