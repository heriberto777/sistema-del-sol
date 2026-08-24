import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** "Mensaje a cajas" (plan de integración Cuadre, ítem J-3) — broadcast de texto a todos los terminales POS del tenant. */
export class PublicarMensajeCajasDto {
  @ApiProperty({ example: 'Cierre anticipado hoy a las 6pm' })
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  texto: string;
}
