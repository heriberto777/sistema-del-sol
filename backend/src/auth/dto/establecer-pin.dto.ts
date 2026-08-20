import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class EstablecerPinDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  passwordActual: string;

  @ApiProperty({ description: 'PIN de 4 a 6 dígitos numéricos' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'El PIN debe tener entre 4 y 6 dígitos numéricos' })
  pin: string;
}
