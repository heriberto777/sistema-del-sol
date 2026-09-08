import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class EnviarWhatsappPublicacionSocialDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  telefono: string;
}
