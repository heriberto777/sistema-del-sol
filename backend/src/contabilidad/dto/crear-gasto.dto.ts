import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CrearGastoDto {
  @ApiProperty()
  @IsString()
  concepto: string;

  @ApiProperty()
  @IsPositive()
  monto: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({ description: 'Cuenta de gasto que se debita (ej. Gastos Operativos)' })
  @IsUUID()
  cuentaGastoId: string;

  @ApiProperty({ description: 'De dónde sale el dinero: Caja/Bancos si es al contado, Cuentas por Pagar si es a crédito' })
  @IsUUID()
  cuentaOrigenId: string;
}
