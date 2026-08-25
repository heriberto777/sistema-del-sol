import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResponderWhatsappDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  contenido: string;
}
