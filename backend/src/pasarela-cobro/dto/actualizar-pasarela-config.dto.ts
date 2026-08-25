import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Todos los campos opcionales — solo se actualiza lo que venga. Para el
 * único de secreto (azulAuthKey): string no vacío = nuevo valor (se cifra
 * server-side), "" = borra el override, omitido = sin cambios. CardNet
 * ("Botón de Pago — Web con Pantalla") no usa clave de firma — autentica
 * con TLS 1.2 + MerchantNumber/MerchantTerminal, sin secreto que cifrar.
 */
export class ActualizarPasarelaConfigDto {
  @ApiProperty({ required: false, enum: ['AZUL', 'CARDNET'], description: 'null/omitido = ninguna pasarela activa' })
  @IsOptional()
  @IsIn(['AZUL', 'CARDNET'])
  pasarelaActiva?: 'AZUL' | 'CARDNET' | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  azulMerchantId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  azulMerchantName?: string;

  @ApiProperty({ required: false, description: 'Provisto por AZUL al momento de la afiliación — no es un código ISO 4217 genérico' })
  @IsOptional()
  @IsString()
  azulCurrencyCode?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  azulAuthKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cardnetMerchantNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cardnetMerchantTerminal?: string;

  @ApiProperty({ required: false, description: 'Opcional — solo si el comercio procesa American Express' })
  @IsOptional()
  @IsString()
  cardnetMerchantTerminalAmex?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cardnetMerchantName?: string;

  @ApiProperty({ required: false, description: 'Código de categoría de comercio (MCC), asignado por CardNet' })
  @IsOptional()
  @IsString()
  cardnetMerchantType?: string;

  @ApiProperty({ required: false, description: 'Asignado por CardNet al afiliarse' })
  @IsOptional()
  @IsString()
  cardnetAcquiringInstitutionCode?: string;
}
