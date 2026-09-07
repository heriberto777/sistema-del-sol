import { ApiProperty } from '@nestjs/swagger';
import { EstadoProyecto, ModoFacturacionProyecto } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CrearProyectoDto {
  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ description: 'Cliente ya cargado en Contactos' })
  @IsUUID()
  clienteId: string;

  @ApiProperty({ required: false, description: 'Empleado responsable del proyecto' })
  @IsOptional()
  @IsUUID()
  responsableId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  presupuesto?: number;

  @ApiProperty({ enum: ModoFacturacionProyecto, default: ModoFacturacionProyecto.PRECIO_FIJO })
  @IsEnum(ModoFacturacionProyecto)
  modoFacturacion: ModoFacturacionProyecto;

  @ApiProperty({ required: false, description: 'Solo si modoFacturacion = POR_HORAS — tarifa que se le cobra al cliente por hora' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tarifaHoraFacturable?: number;

  @ApiProperty({ enum: EstadoProyecto, required: false, default: EstadoProyecto.PLANIFICADO })
  @IsOptional()
  @IsEnum(EstadoProyecto)
  estado?: EstadoProyecto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaFinEstimada?: string;
}
