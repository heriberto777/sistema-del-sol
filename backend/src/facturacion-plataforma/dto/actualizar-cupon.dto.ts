import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Solo lo operativo es editable — `codigo`/`tipo`/`valor`/`duracionCiclos`
 * quedan fijos una vez creado el cupón (ya pueden estar aplicados a
 * suscripciones en curso; cambiarlos retroactivamente movería el
 * descuento de un tenant sin que nadie se los haya vuelto a explicar).
 * Para "cambiar las condiciones", se desactiva este código y se crea uno nuevo.
 */
export class ActualizarCuponDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaExpiracion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  usosMaximos?: number;

  @ApiProperty({ required: false, description: 'false = ya no se puede canjear (no afecta aplicaciones en curso)' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
