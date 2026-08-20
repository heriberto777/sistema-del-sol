import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CrearFormaPagoDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  nombre: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  requiereReferencia?: boolean;

  @ApiProperty({ required: false, default: false, description: 'Marca esta forma de pago como efectivo físico para el arqueo de caja del POS — como mucho una por tenant debería tenerlo en true.' })
  @IsOptional()
  @IsBoolean()
  esEfectivo?: boolean;

  @ApiProperty({ required: false, default: false, description: 'Marca esta forma de pago como canje de Bono (Fase 4c) — el pago se valida y descuenta contra un Bono real por su código, guardado en la referencia.' })
  @IsOptional()
  @IsBoolean()
  esBono?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
