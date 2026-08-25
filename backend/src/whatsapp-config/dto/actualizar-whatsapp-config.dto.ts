import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Todos los campos opcionales — solo se actualiza lo que venga. Para los
 * de secreto (twilioAuthToken/iaApiKey): string no vacío = nuevo valor (se
 * cifra server-side), "" = borra el override, omitido = sin cambios. Nunca
 * se aceptan/devuelven en texto plano fuera de este flujo.
 */
export class ActualizarWhatsappConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  habilitado?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  twilioAccountSid?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  twilioAuthToken?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  twilioWhatsappFrom?: string;

  @ApiProperty({ required: false, enum: ['ANTHROPIC', 'OPENAI', 'VERCEL'] })
  @IsOptional()
  @IsString()
  iaProveedor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  iaModelo?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  iaApiKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  historialMensajes?: number;
}
