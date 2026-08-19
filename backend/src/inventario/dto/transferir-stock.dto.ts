import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class TransferirStockDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty({ required: false, description: 'Obligatorio si el producto tiene más de una variante' })
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @ApiProperty()
  @IsUUID()
  bodegaOrigenId: string;

  @ApiProperty()
  @IsUUID()
  bodegaDestinoId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;
}
