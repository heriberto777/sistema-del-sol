import { ApiProperty } from '@nestjs/swagger';
import { ModalidadFacturacion } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Todos los campos opcionales — solo se actualiza lo que venga. Para los
 * de secreto (password/token): string no vacío = nuevo valor (se cifra
 * server-side), "" = borra el override (vuelve a .env), omitido = sin
 * cambios. Nunca se aceptan/devuelven en texto plano fuera de este flujo.
 */
export class ActualizarPlataformaConfigDto {
  // General
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nombreNegocio?: string;

  @ApiProperty({ required: false, description: 'Data URI de la imagen — se muestra en el Login, antes de resolver tenant.' })
  @IsOptional()
  @IsString()
  logo?: string;

  // Datos de la empresa emisora — ítem "Facturación con NCF real"
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rnc?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false, enum: ModalidadFacturacion, description: 'NCF tradicional o e-CF para las facturas que la plataforma emite a cada tenant' })
  @IsOptional()
  @IsEnum(ModalidadFacturacion)
  modalidadFacturacion?: ModalidadFacturacion;

  @ApiProperty({ required: false, description: '% de ITBIS aplicado a cada FacturaPlataforma nueva (0 = sin ITBIS)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeItbis?: number;

  // Notificaciones — email
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  emailHabilitado?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  smtpPort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpFrom?: string;

  // Notificaciones — WhatsApp
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

  // Pasarela de pago
  @ApiProperty({ required: false, enum: ['stripe', 'azul', 'cardnet'] })
  @IsOptional()
  @IsString()
  pasarelaActiva?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  stripeSecretKey?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  stripeWebhookSecret?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  stripeCurrency?: string;

  // Webhook de plataforma
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  webhookActivo?: boolean;

  // Fase 4 — auto-suspensión de tenants morosos
  @ApiProperty({ required: false, description: 'Días de mora (factura VENCIDA sin pago) antes de suspender automáticamente el tenant' })
  @IsOptional()
  @IsInt()
  diasParaAutoSuspender?: number;
}
