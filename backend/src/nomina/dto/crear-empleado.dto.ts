import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

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

  @ApiProperty({
    required: false,
    description:
      'Catálogo de puestos (plan de integración Cuadre, ítem G-8) — puramente clasificatorio, no reemplaza `cargo` (texto libre, sigue siendo lo que resuelve "Vendedor").',
  })
  @IsOptional()
  @IsUUID()
  puestoId?: string;

  @ApiProperty({
    required: false,
    description:
      'Plantilla de horario reutilizable (plan de integración Cuadre, ítem G-1) — referencia viva. Sin enviar, se auto-asigna la plantilla marcada `predeterminada` del tenant, si existe alguna.',
  })
  @IsOptional()
  @IsUUID()
  plantillaHorarioId?: string;

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

  @ApiProperty({
    required: false,
    description: 'Vincula el empleado a un User de login (habilita el check-in/check-out de autoservicio) desde el alta.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
