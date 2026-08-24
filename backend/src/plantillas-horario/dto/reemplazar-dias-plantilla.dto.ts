import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { FranjaHorarioDto } from '../../nomina/dto/reemplazar-horario.dto';

/** Reemplaza los días completos de la plantilla — un array vacío la deja sin ningún día configurado. Mismo criterio que ReemplazarHorarioDto (individual por empleado). */
export class ReemplazarDiasPlantillaDto {
  @ApiProperty({ type: [FranjaHorarioDto] })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => FranjaHorarioDto)
  dias: FranjaHorarioDto[];
}
