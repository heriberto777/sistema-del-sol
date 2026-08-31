import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CrearProveedorDto {
  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rnc?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({
    required: false,
    default: 30,
    description: 'Crédito general con este proveedor (ítem Cuentas por Pagar) — todas sus órdenes lo heredan al calcular vencimiento.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  plazoPagoDias?: number;
}
