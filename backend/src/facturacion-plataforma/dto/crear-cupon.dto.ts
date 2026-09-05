import { ApiProperty } from '@nestjs/swagger';
import { TipoCupon } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CrearCuponDto {
  @ApiProperty({ description: 'Código que el super admin ingresa para canjear — se guarda en mayúsculas' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,40}$/, { message: 'El código solo admite letras, números, guiones y guiones bajos (3-40 caracteres)' })
  codigo!: string;

  @ApiProperty({ enum: TipoCupon })
  @IsEnum(TipoCupon)
  tipo!: TipoCupon;

  @ApiProperty({ description: '% (0-100) si tipo=PORCENTAJE, monto fijo en la moneda de la factura si tipo=MONTO_FIJO' })
  @IsNumber()
  @Min(0)
  valor!: number;

  @ApiProperty({ required: false, description: 'Cuántas facturas dura el descuento — vacío = indefinido mientras la suscripción esté activa' })
  @IsOptional()
  @IsInt()
  @Min(1)
  duracionCiclos?: number;

  @ApiProperty({ required: false, description: 'Después de esta fecha el código ya no se puede canjear' })
  @IsOptional()
  @IsDateString()
  fechaExpiracion?: string;

  @ApiProperty({ required: false, description: 'Tope total de tenants que pueden canjear este código — vacío = sin tope' })
  @IsOptional()
  @IsInt()
  @Min(1)
  usosMaximos?: number;
}
