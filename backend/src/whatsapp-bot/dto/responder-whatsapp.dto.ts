import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResponderWhatsappDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  contenido: string;

  @ApiPropertyOptional({ description: 'Si viene, se manda además la foto de este producto (mediaUrl vía el endpoint público de imagen).' })
  @IsOptional()
  @IsString()
  productoId?: string;
}
