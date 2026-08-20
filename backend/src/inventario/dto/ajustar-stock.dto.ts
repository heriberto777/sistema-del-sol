import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class AjustarStockDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty({ required: false, description: 'Obligatorio si el producto tiene más de una variante' })
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @ApiProperty()
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ description: 'Positivo para agregar, negativo para restar' })
  @IsNumber()
  cantidad: number;

  @ApiProperty()
  @IsString()
  motivo: string;

  @ApiProperty({ required: false, description: 'Solo si el producto controla vencimiento y cantidad > 0 (entrada): número de lote a acreditar' })
  @IsOptional()
  @IsString()
  numeroLote?: string;

  @ApiProperty({ required: false, description: 'Solo si el producto controla vencimiento y cantidad > 0 (entrada)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaVencimiento?: Date;

  @ApiProperty({ required: false, description: 'Solo si el producto controla vencimiento y cantidad < 0 (salida): de qué lote sale — siempre explícito, nunca FEFO en un ajuste manual' })
  @IsOptional()
  @IsUUID()
  loteId?: string;
}
