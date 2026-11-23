import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CrearDepositoBancarioDto {
  @ApiProperty({ description: 'Cuenta bancaria destino del depósito' })
  @IsUUID()
  cuentaBancariaId: string;

  @ApiProperty({ description: 'Monto depositado' })
  @IsNumber()
  @IsPositive()
  monto: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({ required: false, description: 'Número del recibo/comprobante de depósito del banco' })
  @IsOptional()
  @IsString()
  numeroComprobante?: string;

  @ApiProperty({ required: false, description: 'Informativo — de qué sucursal/bodega salió el efectivo (no afecta el asiento, que siempre es tenant-wide)' })
  @IsOptional()
  @IsUUID()
  bodegaId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notas?: string;
}
