import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsUUID } from 'class-validator';

export class AjustarStockDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

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
