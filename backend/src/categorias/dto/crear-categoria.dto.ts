import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

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
}
