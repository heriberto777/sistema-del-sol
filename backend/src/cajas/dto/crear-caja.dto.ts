import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CrearCajaDto {
  @ApiProperty()
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ required: false, description: 'Autogenerado desde el correlativo parametrizado — ignorado al crear, se acepta solo para edición interna.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  codigo?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  nombre: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @ApiProperty({
    type: [String],
    required: false,
    description: 'Ítem E-7 — categorías que esta Caja puede vender (lista blanca combinada con productoIds). Vacío/omitido junto con productoIds = sin restricción, vende todo el catálogo.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoriaIds?: string[];

  @ApiProperty({ type: [String], required: false, description: 'Ítem E-7 — productos puntuales que esta Caja puede vender, además de los de categoriaIds' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productoIds?: string[];

  @ApiProperty({
    type: [String],
    required: false,
    description: 'Ítem E-7 — accesos rápidos en la grilla del POS, independiente de la restricción de categoriaIds/productoIds',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  favoritoIds?: string[];
}
