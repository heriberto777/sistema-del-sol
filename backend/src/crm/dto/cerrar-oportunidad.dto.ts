import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

/** Obligatorio motivoPerdida solo si estado = PERDIDA (validado en el servicio) — texto libre, ver el artifact de diseño (sin catálogo propio en Fase 1). */
export class CerrarOportunidadDto {
  @IsEnum(['GANADA', 'PERDIDA'])
  estado: 'GANADA' | 'PERDIDA';

  @IsOptional()
  @IsString()
  @MinLength(3)
  motivoPerdida?: string;
}
