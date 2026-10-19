import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsUUID, ValidateNested } from 'class-validator';

export class LineaOcDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty({ required: false, description: 'Obligatorio si el producto tiene más de una variante (Fase 3c)' })
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @ApiProperty({
    required: false,
    description:
      'Unidad en la que se expresan cantidad/costoUnitario de esta línea (ej. "Caja") — debe ser la unidad base o una ProductoUnidadConversion del producto. Sin este campo, cantidad/costoUnitario quedan en la unidad base (comportamiento histórico).',
  })
  @IsOptional()
  @IsUUID()
  unidadMedidaId?: string;

  @ApiProperty({ description: 'En la unidad elegida (unidadMedidaId) — ej. 10 Cajas, no 1440 unidades.' })
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @ApiProperty({ description: 'Costo por unidad elegida (unidadMedidaId) — ej. costo por Caja, no por unidad suelta.' })
  @IsNumber()
  @IsPositive()
  costoUnitario: number;
}

export class CrearOrdenCompraDto {
  @ApiProperty()
  @IsUUID()
  proveedorId: string;

  @ApiProperty({ type: [LineaOcDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaOcDto)
  lineas: LineaOcDto[];
}
