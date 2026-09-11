import { ApiProperty } from '@nestjs/swagger';
import { EstadoTareaPersonal, PrioridadTareaPersonal } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearTareaPersonalDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  titulo: string;

  @ApiProperty({ enum: PrioridadTareaPersonal, required: false, default: PrioridadTareaPersonal.MEDIA })
  @IsOptional()
  @IsEnum(PrioridadTareaPersonal)
  prioridad?: PrioridadTareaPersonal;

  @ApiProperty({ enum: EstadoTareaPersonal, required: false, default: EstadoTareaPersonal.PENDIENTE })
  @IsOptional()
  @IsEnum(EstadoTareaPersonal)
  estado?: EstadoTareaPersonal;

  @ApiProperty({ required: false, description: 'Día asignado — sin fecha queda en la bandeja general' })
  @IsOptional()
  @IsDateString()
  fecha?: string | null;

  @ApiProperty({ required: false, type: [String], description: 'Texto libre — el frontend sugiere algunas, pero acepta cualquiera' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  etiquetas?: string[];
}
