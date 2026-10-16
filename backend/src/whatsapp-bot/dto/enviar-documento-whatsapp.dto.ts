import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export const TIPOS_DOCUMENTO_WHATSAPP = [
  'FACTURA',
  'COTIZACION',
  'ESTADO_CUENTA',
  'FACTURAS_RECIENTES',
  'FACTURAS_PENDIENTES',
  'COTIZACIONES_RECIENTES',
] as const;
export type TipoDocumentoWhatsapp = (typeof TIPOS_DOCUMENTO_WHATSAPP)[number];

export class EnviarDocumentoWhatsappDto {
  @ApiProperty()
  @IsString()
  clienteId: string;

  @ApiProperty({ enum: TIPOS_DOCUMENTO_WHATSAPP })
  @IsEnum(TIPOS_DOCUMENTO_WHATSAPP)
  tipo: TipoDocumentoWhatsapp;

  @ApiPropertyOptional({ description: 'Requerido cuando tipo es FACTURA o COTIZACION — el id de ese documento puntual.' })
  @IsOptional()
  @IsString()
  documentoId?: string;
}
