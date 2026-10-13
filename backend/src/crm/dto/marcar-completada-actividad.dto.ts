import { IsBoolean } from 'class-validator';

export class MarcarCompletadaActividadDto {
  @IsBoolean()
  completada: boolean;
}
