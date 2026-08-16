import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TipoCuentaBancaria } from '@prisma/client';

export class CrearCuentaBancariaDto {
  @ApiProperty()
  @IsString()
  banco: string;

  @ApiProperty()
  @IsString()
  numeroCuenta: string;

  @ApiProperty({ enum: TipoCuentaBancaria })
  @IsEnum(TipoCuentaBancaria)
  tipoCuenta: TipoCuentaBancaria;

  @ApiProperty({ description: 'Cuenta del catálogo contable (tipo ACTIVO) que representa este banco en el balance' })
  @IsUUID()
  cuentaContableId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
