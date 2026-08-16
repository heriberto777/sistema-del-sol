import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class ActualizarEmpleadoDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  cedula?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cargo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departamento?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  salarioBrutoMensual?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ required: false, description: 'Fecha de salida — desactiva al empleado si se envía' })
  @IsOptional()
  @IsDateString()
  fechaSalida?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaIngreso?: string;

  @ApiProperty({ enum: ['INDEFINIDO', 'DETERMINADO'], required: false })
  @IsOptional()
  @IsIn(['INDEFINIDO', 'DETERMINADO'])
  tipoContrato?: 'INDEFINIDO' | 'DETERMINADO';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telefono?: string;
}
