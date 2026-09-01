import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** "Mensaje a cajas" (plan de integración Cuadre, ítem J-3) — broadcast de texto a todos los terminales POS del tenant, o dirigido a una caja puntual. */
export class PublicarMensajeCajasDto {
  @ApiProperty({ example: 'Cierre anticipado hoy a las 6pm' })
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  texto: string;

  @ApiProperty({ required: false, description: 'Sin esto, el mensaje llega a todas las cajas — con esto, solo a la caja de este turno.' })
  @IsOptional()
  @IsUUID()
  turnoCajaId?: string;
}
