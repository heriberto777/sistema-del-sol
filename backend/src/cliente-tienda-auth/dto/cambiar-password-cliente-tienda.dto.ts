import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CambiarPasswordClienteTiendaDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  passwordActual: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  passwordNueva: string;
}
