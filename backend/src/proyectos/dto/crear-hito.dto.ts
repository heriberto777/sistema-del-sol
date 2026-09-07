import { ApiProperty } from '@nestjs/swagger';
import { EstadoHitoProyecto } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CrearHitoDto {
  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaObjetivo?: string;

  @ApiProperty({ required: false, description: 'Solo si el proyecto es PRECIO_FIJO — monto pactado de antemano para este hito' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoFijo?: number;

  @ApiProperty({ enum: EstadoHitoProyecto, required: false, default: EstadoHitoProyecto.PENDIENTE })
  @IsOptional()
  @IsEnum(EstadoHitoProyecto)
  estado?: EstadoHitoProyecto;
}
