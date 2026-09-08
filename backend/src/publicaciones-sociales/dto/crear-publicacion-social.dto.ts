import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CrearPublicacionSocialDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty()
  @IsUUID()
  plantillaId: string;

  /** Fase 2 — si viene, el fondo se genera con IA a partir de la foto real del producto + este texto; si no, se usa la foto tal cual (Fase 1). */
  @ApiProperty({ required: false, description: 'Describe la ambientación deseada — genera el fondo con IA' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  promptIa?: string;
}
