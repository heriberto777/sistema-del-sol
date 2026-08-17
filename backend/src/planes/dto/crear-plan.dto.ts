import { ApiProperty } from '@nestjs/swagger';
import { CicloFacturacion } from '@prisma/client';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CrearPlanDto {
  @ApiProperty({ example: 'Profesional' })
  @IsString()
  nombre: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ required: false, default: 0, description: 'Precio de lista del plan (el descuento, si aplica, va en la factura)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precio?: number;

  @ApiProperty({ required: false, enum: CicloFacturacion, default: CicloFacturacion.MENSUAL })
  @IsOptional()
  @IsEnum(CicloFacturacion)
  cicloFacturacion?: CicloFacturacion;

  @ApiProperty({ type: [String], description: 'Claves de módulos incluidos (ver MODULOS_BASE)' })
  @IsArray()
  @IsString({ each: true })
  modulos: string[];
}
