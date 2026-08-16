import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class TransferirStockDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

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
