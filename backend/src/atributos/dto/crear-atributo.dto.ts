import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CrearAtributoDto {
  @ApiProperty({ description: 'Ej. "Talla", "Color"' })
  @IsString()
  @MinLength(2)
  nombre: string;
}
