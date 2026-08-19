import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CrearValorAtributoDto {
  @ApiProperty({ description: 'Ej. "M", "Azul"' })
  @IsString()
  @MinLength(1)
  valor: string;
}
