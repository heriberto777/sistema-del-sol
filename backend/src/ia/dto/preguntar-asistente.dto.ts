import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class PreguntarAsistenteDto {
  @ApiProperty({ description: 'Pregunta en lenguaje natural sobre el negocio (ventas, stock, compras pendientes, etc.)' })
  @IsString()
  @MinLength(3)
  pregunta: string;
}
