import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { OperacionPropiedad, TipoPropiedad } from '@prisma/client';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class ListadoPropiedadesPublicoQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsEnum(OperacionPropiedad)
  operacion?: OperacionPropiedad;

  @IsOptional()
  @IsEnum(TipoPropiedad)
  tipo?: TipoPropiedad;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  precioMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  precioMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  habitacionesMin?: number;

  /** Favoritos/comparador (Fase 4) — lista de ids separados por coma, ej. `?ids=a,b,c`. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @IsUUID('4', { each: true })
  ids?: string[];
}
