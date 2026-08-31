import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** Solo activar/desactivar — para cambiar offset/canal, se borra y se crea de nuevo (mismo criterio que notas de crédito/débito de tenant). */
export class ActualizarReglaNotificacionDto {
  @ApiProperty()
  @IsBoolean()
  activa: boolean;
}
