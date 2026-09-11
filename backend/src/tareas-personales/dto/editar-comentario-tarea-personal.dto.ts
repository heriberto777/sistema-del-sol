import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Solo el texto es editable — las imágenes ya adjuntas quedan como están (evita reabrir todo el flujo de subida al corregir una nota). */
export class EditarComentarioTareaPersonalDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  contenido: string;
}
