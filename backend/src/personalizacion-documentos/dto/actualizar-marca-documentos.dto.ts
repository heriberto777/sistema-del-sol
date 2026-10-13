import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class ActualizarMarcaDocumentosDto {
  /** Color hex ej. "#c7922f". String vacío limpia el color (vuelve cada plantilla a su color original). */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^$|^#[0-9a-fA-F]{6}$/, { message: 'colorAcentoDocumentos debe ser un color hex válido (#rrggbb) o vacío' })
  colorAcentoDocumentos?: string;
}
