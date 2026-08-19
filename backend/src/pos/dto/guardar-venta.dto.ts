import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class LineaVentaAparcadaDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty({ required: false, description: 'Obligatorio si el producto tiene más de una variante (Fase 3c)' })
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  porcentajeItbis: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;
}

export class GuardarVentaDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  vendedorEmpleadoId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nota?: string;

  @ApiProperty({ type: [LineaVentaAparcadaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaVentaAparcadaDto)
  lineas: LineaVentaAparcadaDto[];
}
