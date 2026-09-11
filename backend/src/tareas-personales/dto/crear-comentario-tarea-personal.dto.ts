import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CrearComentarioTareaPersonalDto {
  @ApiProperty({ description: 'Texto plano — un bloque ```así``` se muestra resaltado como código al renderizar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  contenido: string;

  @ApiProperty({ required: false, type: [String], description: 'Data URIs (comprimidas en el navegador)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, { each: true, message: 'cada imagen debe ser una data URI de imagen (jpeg/png/webp)' })
  @MaxLength(2_000_000, { each: true, message: 'La imagen es demasiado pesada — comprimila antes de subirla' })
  imagenes?: string[];
}
