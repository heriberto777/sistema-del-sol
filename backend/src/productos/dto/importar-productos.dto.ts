import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Max, Min, MinLength, ValidateNested } from 'class-validator';

/**
 * `tipo` restringido a PRODUCTO/SERVICIO — COMBO queda fuera de la
 * importación masiva a propósito (sus `componentes` no tienen forma
 * razonable de expresarse en una fila plana de Excel; se rechaza con un
 * error puntual por fila en vez de intentar adivinar). `stock` tampoco
 * se importa: se gestiona vía Inventario (ajustes/compras), no
 * sobreescribiéndolo desde un catálogo.
 */
export class FilaImportarProductoDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  codigo: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  nombre: string;

  @ApiProperty({ required: false, description: 'Nombre de categoría — se busca por nombre exacto y se crea (a nivel raíz) si no existe' })
  @IsOptional()
  @IsString()
  categoria?: string;

  @ApiProperty({ required: false, enum: ['PRODUCTO', 'SERVICIO'] })
  @IsOptional()
  @IsIn(['PRODUCTO', 'SERVICIO'])
  tipo?: 'PRODUCTO' | 'SERVICIO';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unidadMedida?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeItbis?: number;

  @ApiProperty({ required: false, description: 'Si se manda, crea un Precio (lista GENERAL) con costo = precioVenta (margen 0) — refinar costo/margen después desde Precios' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioGeneral?: number;

  @ApiProperty({ required: false, description: 'Se asigna a la variante "por defecto" del producto — productos con variantes reales (Talla/Color) no son soportados por la importación masiva' })
  @IsOptional()
  @IsString()
  codigoBarras?: string;
}

export class ImportarProductosDto {
  @ApiProperty({ type: [FilaImportarProductoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FilaImportarProductoDto)
  productos: FilaImportarProductoDto[];
}
