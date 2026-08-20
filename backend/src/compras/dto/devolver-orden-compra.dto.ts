import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export class LineaDevolucionDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @ApiProperty({ required: false, description: 'Obligatorio si el producto controla vencimiento (Fase 5b) — de qué lote sale, elegido a mano (nunca FEFO en una devolución a proveedor)' })
  @IsOptional()
  @IsUUID()
  loteId?: string;
}

export class DevolverOrdenCompraDto {
  @ApiProperty({ description: 'Bodega de donde sale la mercancía que se devuelve' })
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiProperty({ type: [LineaDevolucionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaDevolucionDto)
  lineas: LineaDevolucionDto[];
}
