import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AnularFacturaDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  motivo: string;
}
