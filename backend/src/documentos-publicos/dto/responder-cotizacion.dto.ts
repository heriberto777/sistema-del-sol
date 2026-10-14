import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ResponderCotizacionDto {
  @IsEnum(['ACEPTADA', 'RECHAZADA'])
  decision: 'ACEPTADA' | 'RECHAZADA';

  /** Obligatorio si decision es RECHAZADA — validado en el servicio (mismo criterio que CerrarOportunidadDto.motivoPerdida), no acá, para poder dar un mensaje de error específico. */
  @IsOptional()
  @IsString()
  motivo?: string;
}
