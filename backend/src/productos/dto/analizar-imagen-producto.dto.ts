import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class AnalizarImagenProductoDto {
  @ApiProperty({ description: 'Data URI completa (data:image/...;base64,...) — misma validación que CrearProductoDto.imagen.' })
  @IsString()
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, { message: 'imagen debe ser una data URI de imagen (jpeg/png/webp)' })
  @MaxLength(2_000_000, { message: 'La imagen es demasiado pesada — comprimila antes de analizarla' })
  imagen: string;
}
