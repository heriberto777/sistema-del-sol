import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmptyObject, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** Agregar un mensaje a un ticket ya existente — usado por ambos lados (tenant y plataforma), cada uno con su propio controller/endpoint. */
export class CrearMensajeReporteTenantDto {
  @ApiProperty({ description: 'Documento de Tiptap (JSON).' })
  @IsObject()
  @IsNotEmptyObject()
  cuerpo: object;

  @ApiProperty({ required: false, description: 'Adjunto en base64 (sin el prefijo data:...;base64,) — máx. ~5MB.' })
  @IsOptional()
  @IsString()
  @MaxLength(7_000_000)
  adjuntoBase64?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  adjuntoNombre?: string;
}
