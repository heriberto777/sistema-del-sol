import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDate, IsEnum, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { MotivoAjusteInventario } from '@prisma/client';

/** Una línea de AjusteInventario — mismos campos que AjustarStockDto (ítem E-2), sin `pin` (eso va en confirmar, no por línea). */
export class LineaAjusteInventarioDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty({ required: false, description: 'Obligatorio si el producto tiene más de una variante' })
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @ApiProperty({ description: 'Positivo para agregar, negativo para restar' })
  @IsNumber()
  cantidad: number;

  @ApiProperty({ enum: MotivoAjusteInventario, description: 'Categoría estructurada del ajuste (ítem E-2)' })
  @IsEnum(MotivoAjusteInventario)
  motivoAjuste: MotivoAjusteInventario;

  @ApiProperty({ required: false, description: 'Detalle libre opcional, además de la categoría estructurada' })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiProperty({ required: false, description: 'Solo si el producto controla vencimiento y cantidad > 0 (entrada): número de lote a acreditar' })
  @IsOptional()
  @IsString()
  numeroLote?: string;

  @ApiProperty({ required: false, description: 'Solo si el producto controla vencimiento y cantidad > 0 (entrada)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaVencimiento?: Date;

  @ApiProperty({ required: false, description: 'Solo si el producto controla vencimiento y cantidad < 0 (salida): de qué lote sale' })
  @IsOptional()
  @IsUUID()
  loteId?: string;
}

export class CrearAjusteInventarioDto {
  @ApiProperty()
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ type: [LineaAjusteInventarioDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaAjusteInventarioDto)
  lineas: LineaAjusteInventarioDto[];
}
