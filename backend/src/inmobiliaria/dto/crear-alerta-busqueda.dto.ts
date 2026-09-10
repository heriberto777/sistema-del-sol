import { IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { OperacionPropiedad, TipoPropiedad } from '@prisma/client';

export class CrearAlertaBusquedaDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(OperacionPropiedad)
  operacion?: OperacionPropiedad;

  @IsOptional()
  @IsEnum(TipoPropiedad)
  tipo?: TipoPropiedad;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precioMax?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  habitacionesMin?: number;
}
