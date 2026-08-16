import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SugerirCuentaContableDto {
  @ApiProperty({ description: 'Descripción libre del gasto/movimiento (p. ej. "compra de papel higiénico para el baño")' })
  @IsString()
  @MinLength(3)
  concepto: string;
}
