import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class LineaCotizacionDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @ApiProperty({ required: false, description: 'Si se omite, se toma el precio de venta vigente del producto' })
  @IsOptional()
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
  @IsString()
  numero: string;

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
