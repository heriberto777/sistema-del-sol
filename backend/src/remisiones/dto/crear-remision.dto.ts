import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsUUID, ValidateNested } from 'class-validator';

export class LineaRemisionDto {
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
      'Unidad en la que se expresa cantidad de esta línea (ej. "Caja") — igual criterio que Facturación. Una Remisión mueve stock ella misma al pasar a ENTREGADA, así que esto afecta inventario, no solo presentación.',
  })
  @IsOptional()
  @IsUUID()
  unidadMedidaId?: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;
}

export class CrearRemisionDto {
  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty()
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ type: [LineaRemisionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaRemisionDto)
  lineas: LineaRemisionDto[];
}
