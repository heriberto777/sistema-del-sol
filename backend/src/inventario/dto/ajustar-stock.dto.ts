import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
