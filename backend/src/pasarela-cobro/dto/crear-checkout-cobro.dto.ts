import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class CrearCheckoutCobroDto {
  @ApiProperty({ description: 'Monto a pagar — puede ser parcial, tope el saldo pendiente de la factura' })
  @IsNumber()
  @IsPositive()
  monto: number;
}
