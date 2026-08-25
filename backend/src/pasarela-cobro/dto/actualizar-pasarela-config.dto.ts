import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Todos los campos opcionales — solo se actualiza lo que venga. Para los
 * de secreto (azulAuth1/azulAuth2/cardnetAuthKey): string no vacío = nuevo
 * valor (se cifra server-side), "" = borra el override, omitido = sin
 * cambios. Nunca se aceptan/devuelven en texto plano fuera de este flujo.
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

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  azulAuth1?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  azulAuth2?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cardnetMerchantNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cardnetMerchantTerminal?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cardnetMerchantName?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  cardnetAuthKey?: string;
}
