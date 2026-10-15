import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Todos los campos opcionales — solo se actualiza lo que venga. Para los
 * de secreto (duffelApiToken/duffelWebhookSecret/hotelbedsApiKey/
 * hotelbedsSecret): string no vacío = nuevo valor (se cifra server-side),
 * "" = borra el override, omitido = sin cambios. Nunca se aceptan/
 * devuelven en texto plano fuera de este flujo.
 */
export class ActualizarTravelConfigDto {
  @ApiProperty({ required: false, description: '"duffel_test_..." en sandbox / "duffel_live_..." en producción — "" borra el override guardado' })
  @IsOptional()
  @IsString()
  duffelApiToken?: string;

  @ApiProperty({ required: false, description: 'Secreto para verificar la firma del webhook de Duffel (X-Duffel-Signature) — "" borra el override guardado' })
  @IsOptional()
  @IsString()
  duffelWebhookSecret?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  hotelbedsApiKey?: string;

  @ApiProperty({ required: false, description: 'Usado junto al Api-key para firmar cada request (X-Signature) — "" borra el override guardado' })
  @IsOptional()
  @IsString()
  hotelbedsSecret?: string;

  @ApiProperty({ required: false, description: 'Moneda en la que se muestran/venden las tarifas de hotel — Hotelbeds siempre cotiza en EUR, esto convierte. Vacío o "EUR" = sin conversión.' })
  @IsOptional()
  @IsString()
  hotelbedsMoneda?: string;

  @ApiProperty({ required: false, description: 'Tasa manual 1 EUR = N de hotelbedsMoneda — obligatoria si hotelbedsMoneda no es EUR' })
  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  hotelbedsTasaCambio?: number;
}
