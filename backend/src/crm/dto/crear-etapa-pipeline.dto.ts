import { IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';

export class CrearEtapaPipelineDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsInt()
  @Min(0)
  orden: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probabilidadDefault?: number;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color debe ser un hex de 6 dígitos, ej. #c2660c' })
  color?: string;
}
