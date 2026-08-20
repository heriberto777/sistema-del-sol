import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, Matches, ValidateNested } from 'class-validator';

const DIAS_SEMANA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
const HORA_HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class FranjaHorarioDto {
  @ApiProperty({ enum: DIAS_SEMANA })
  @IsIn(DIAS_SEMANA)
  diaSemana: (typeof DIAS_SEMANA)[number];

  @ApiProperty({ example: '08:00', description: 'Formato HH:MM, 24 horas' })
  @Matches(HORA_HHMM, { message: 'horaEntrada debe tener formato HH:MM (24 horas)' })
  horaEntrada: string;

  @ApiProperty({ example: '17:00', description: 'Formato HH:MM, 24 horas' })
  @Matches(HORA_HHMM, { message: 'horaSalida debe tener formato HH:MM (24 horas)' })
  horaSalida: string;
}

/** Reemplaza el horario completo del empleado — un array vacío lo deja sin ningún día configurado. */
export class ReemplazarHorarioDto {
  @ApiProperty({ type: [FranjaHorarioDto] })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => FranjaHorarioDto)
  dias: FranjaHorarioDto[];
}
