import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

const HORA_HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Registro manual de RRHH — para un empleado sin login o para corregir un olvido de marcaje. */
export class RegistrarAsistenciaManualDto {
  @ApiProperty()
  @IsString()
  empleadoId: string;

  @ApiProperty({ example: '2026-08-20' })
  @IsDateString()
  fecha: string;

  @ApiProperty({ required: false, example: '08:05' })
  @IsOptional()
  @Matches(HORA_HHMM, { message: 'horaEntrada debe tener formato HH:MM (24 horas)' })
  horaEntrada?: string;

  @ApiProperty({ required: false, example: '17:00' })
  @IsOptional()
  @Matches(HORA_HHMM, { message: 'horaSalida debe tener formato HH:MM (24 horas)' })
  horaSalida?: string;
}
