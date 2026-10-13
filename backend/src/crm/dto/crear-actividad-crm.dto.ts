import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';
import { TipoActividadCrm } from '@prisma/client';

/** Exactamente uno de clienteId/leadId/oportunidadId — se puede loguear sobre cualquiera de los tres (validado también en el servicio, ver nota en CrearOportunidadDto). */
export class CrearActividadCrmDto {
  @IsEnum(TipoActividadCrm)
  tipo: TipoActividadCrm;

  @IsString()
  @MinLength(2)
  descripcion: string;

  @ValidateIf((o) => !o.leadId && !o.oportunidadId)
  @IsUUID()
  clienteId?: string;

  @ValidateIf((o) => !o.clienteId && !o.oportunidadId)
  @IsUUID()
  leadId?: string;

  @ValidateIf((o) => !o.clienteId && !o.leadId)
  @IsUUID()
  oportunidadId?: string;

  // Sin fecha = nota retroactiva; con fecha = tarea pendiente (ver schema.prisma).
  @IsOptional()
  @IsDateString()
  fechaProgramada?: string;

  @IsOptional()
  @IsBoolean()
  completada?: boolean;
}
