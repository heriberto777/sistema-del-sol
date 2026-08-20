import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class EliminarPinDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  passwordActual: string;
}
