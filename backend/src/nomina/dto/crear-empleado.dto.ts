import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsIn, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class CrearEmpleadoDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  nombre: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  cedula: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  cargo: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departamento?: string;

  @ApiProperty()
  @IsDateString()
  fechaIngreso: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  salarioBrutoMensual: number;

  @ApiProperty({ enum: ['INDEFINIDO', 'DETERMINADO'], required: false, default: 'INDEFINIDO' })
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
