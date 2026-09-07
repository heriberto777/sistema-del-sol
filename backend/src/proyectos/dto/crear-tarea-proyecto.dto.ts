import { ApiProperty } from '@nestjs/swagger';
import { EstadoTareaProyecto, PrioridadTareaProyecto } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CrearTareaProyectoDto {
  @ApiProperty()
  @IsString()
  titulo: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ required: false, description: 'Hito al que pertenece esta tarea (opcional — una tarea puede no estar ligada a ningún hito)' })
  @IsOptional()
  @IsUUID()
  hitoId?: string | null;

  @ApiProperty({ enum: EstadoTareaProyecto, required: false, default: EstadoTareaProyecto.PENDIENTE })
  @IsOptional()
  @IsEnum(EstadoTareaProyecto)
  estado?: EstadoTareaProyecto;

  @ApiProperty({ enum: PrioridadTareaProyecto, required: false, default: PrioridadTareaProyecto.MEDIA })
  @IsOptional()
  @IsEnum(PrioridadTareaProyecto)
  prioridad?: PrioridadTareaProyecto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
