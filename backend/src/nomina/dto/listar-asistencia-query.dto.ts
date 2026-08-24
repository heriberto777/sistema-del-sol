import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

const ESTADOS_ASISTENCIA = ['PENDIENTE', 'APROBADO', 'RECHAZADO'] as const;

/** `registros_asistencia` crece sin límite (una fila por empleado por día) — sigue el contrato paginado, ver CLAUDE.md. */
export class ListarAsistenciaQueryDto extends ListadoQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  empleadoId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @ApiProperty({ required: false, enum: ESTADOS_ASISTENCIA, description: 'Plan de integración Cuadre, ítem G-3.' })
  @IsOptional()
  @IsIn(ESTADOS_ASISTENCIA)
  estado?: (typeof ESTADOS_ASISTENCIA)[number];
}
