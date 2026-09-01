import { ApiProperty } from '@nestjs/swagger';
import { CicloFacturacion } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ActualizarPlanDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ required: false, description: 'Precio de lista del plan (el descuento, si aplica, va en la factura)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precio?: number;

  @ApiProperty({ required: false, enum: CicloFacturacion })
  @IsOptional()
  @IsEnum(CicloFacturacion)
  cicloFacturacion?: CicloFacturacion;

  @ApiProperty({ required: false, type: [String], description: 'Si se envía, reemplaza el set completo de módulos incluidos' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modulos?: string[];

  @ApiProperty({ required: false, description: 'Un plan inactivo no se puede asignar a un tenant nuevo — los que ya lo tienen lo conservan.' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
