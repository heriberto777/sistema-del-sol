import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SolicitarCambiosPublicacionSocialDto {
  @ApiProperty({ description: 'Qué hay que cambiar en el diseño — obligatorio' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  comentario: string;
}
