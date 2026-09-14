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

  // Dominio propio de tenant — credenciales de la API de Nginx Proxy Manager
  @ApiProperty({ required: false, description: 'URL base de la API de NPM, ej. http://10.0.10.10:81' })
  @IsOptional()
  @IsString()
  npmBaseUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  npmUsuario?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  npmPassword?: string;

  @ApiProperty({ required: false, description: 'Mismo destino interno que ya usa el Proxy Host de app.ciguadev.com en NPM' })
  @IsOptional()
  @IsString()
  npmForwardHost?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  npmForwardPort?: number;

  @ApiProperty({ required: false, description: 'IP pública o app.ciguadev.com — a esto el tenant apunta su propio DNS (CNAME/A record)' })
  @IsOptional()
  @IsString()
  npmPublicHost?: string;

  // IA para analizar la foto de un producto (ítem "Generar con IA")
  @ApiProperty({ required: false, enum: ['claude', 'openai', 'gemini'] })
  @IsOptional()
  @IsString()
  iaImagenProveedorActivo?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado — misma credencial que ANTHROPIC_API_KEY' })
  @IsOptional()
  @IsString()
  iaClaudeApiKey?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  iaOpenaiApiKey?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  iaGeminiApiKey?: string;

  @ApiProperty({ required: false, description: 'Elegido de GET .../ia-imagen/modelos, no tipeado a mano' })
  @IsOptional()
  @IsString()
  iaClaudeModelo?: string;

  @ApiProperty({ required: false, description: 'Elegido de GET .../ia-imagen/modelos, no tipeado a mano' })
  @IsOptional()
  @IsString()
  iaOpenaiModelo?: string;

  @ApiProperty({ required: false, description: 'Elegido de GET .../ia-imagen/modelos, no tipeado a mano' })
  @IsOptional()
  @IsString()
  iaGeminiModelo?: string;

  // Publicaciones Sociales (Fase 2) — generación de FONDO de banner por
  // IA. Reusa iaOpenaiApiKey/iaGeminiApiKey de arriba, Claude no
  // participa (no genera imágenes).
  @ApiProperty({ required: false, enum: ['openai', 'gemini'] })
  @IsOptional()
  @IsString()
  iaFondoProveedorActivo?: string;

  @ApiProperty({ required: false, description: 'Elegido de GET .../ia-fondo/modelos, no tipeado a mano' })
  @IsOptional()
  @IsString()
  iaOpenaiModeloFondo?: string;

  @ApiProperty({ required: false, description: 'Elegido de GET .../ia-fondo/modelos, no tipeado a mano' })
  @IsOptional()
  @IsString()
  iaGeminiModeloFondo?: string;

  @ApiProperty({ required: false, description: 'Tope de generaciones con IA por tenant por mes — el costo por imagen lo paga la plataforma' })
  @IsOptional()
  @IsInt()
  @Min(0)
  iaFondoLimiteMensual?: number;

  // Travel Management (plugin) — cuenta Duffel única y compartida de la plataforma (decisión B2B)
  @ApiProperty({ required: false, description: '"duffel_test_..." en sandbox / "duffel_live_..." en producción — "" borra el override guardado' })
  @IsOptional()
  @IsString()
  duffelApiToken?: string;

  @ApiProperty({ required: false, description: 'Secreto para verificar la firma del webhook de Duffel (X-Duffel-Signature) — "" borra el override guardado' })
  @IsOptional()
  @IsString()
  duffelWebhookSecret?: string;

  // Hotelbeds (plugin, hoteles) — cuenta única y compartida de la plataforma, mismo criterio B2B que Duffel.
  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  hotelbedsApiKey?: string;

  @ApiProperty({ required: false, description: 'Usado junto al Api-key para firmar cada request (X-Signature) — "" borra el override guardado' })
  @IsOptional()
  @IsString()
  hotelbedsSecret?: string;
}
