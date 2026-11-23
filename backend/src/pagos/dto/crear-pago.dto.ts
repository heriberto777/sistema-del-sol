import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CrearPagoDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  monto: number;

  @ApiProperty()
  @IsUUID()
  formaPagoId: string;

  @ApiProperty({ required: false, description: 'Nro. de cheque, confirmación de transferencia, etc. — solo si la forma de pago lo requiere' })
  @IsOptional()
  @IsString()
  referencia?: string;

  @ApiProperty({ required: false, description: 'Si se omite, se usa la fecha/hora actual' })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({
    required: false,
    description: 'Cuenta bancaria real donde entró/salió el dinero — solo aplica si la forma de pago no es efectivo',
  })
  @IsOptional()
  @IsUUID()
  cuentaBancariaId?: string;
}
