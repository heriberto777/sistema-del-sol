import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max } from 'class-validator';

export class CrearRegistroHoraDto {
  @ApiProperty({ description: 'Empleado que trabajó — puede no ser el mismo que está logueado (ej. un supervisor cargando horas de su equipo)' })
  @IsUUID()
  empleadoId: string;

  @ApiProperty()
  @IsDateString()
  fecha: string;

  @ApiProperty({ description: 'Horas trabajadas ese día en esta tarea' })
  @IsNumber()
  @IsPositive()
  @Max(24)
  horas: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nota?: string;
}
