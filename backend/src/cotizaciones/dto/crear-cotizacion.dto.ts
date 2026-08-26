import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class LineaCotizacionDto {
  @ApiProperty({ required: false, description: 'Omitir en una línea manual/libre (ítem B-9) — mutuamente excluyente con descripcionManual' })
  @ValidateIf((o) => !o.descripcionManual)
  @IsUUID()
  productoId?: string;

  @ApiProperty({ required: false, description: 'Obligatorio si el producto tiene más de una variante (Fase 3c) — no aplica a una línea manual' })
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @ApiProperty({
    required: false,
    description: 'Línea libre sin producto del catálogo (ítem B-9) — mutuamente excluyente con productoId. Se propaga tal cual al convertir en factura.',
  })
  @ValidateIf((o) => !o.productoId)
  @IsString()
  @IsNotEmpty()
  descripcionManual?: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @ApiProperty({ required: false, description: 'Si se omite, se toma el precio de venta vigente del producto — obligatorio en una línea manual' })
  @ValidateIf((o) => !o.productoId || o.precioUnitario !== undefined)
  @IsNumber()
  @Min(0)
  precioUnitario?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;
}

export class CrearCotizacionDto {
  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty({ description: 'Fecha hasta la que la cotización es válida' })
  @IsDateString()
  fechaVigenciaHasta: string;

  @ApiProperty({ type: [LineaCotizacionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaCotizacionDto)
  lineas: LineaCotizacionDto[];

  @ApiProperty({
    required: false,
    description:
      'Nivel de precio para resolver el precio vigente de cada línea sin precioUnitario explícito. Si se omite, se usa el listaPrecioId del cliente (o "GENERAL" si no tiene uno asignado).',
  })
  @IsOptional()
  @IsString()
  listaPrecio?: string;
}
