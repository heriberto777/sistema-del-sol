import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappMensajesRepository } from './whatsapp-mensajes.repository';
import { verificarFirmaTwilio } from './twilio-signature.util';
import { IaClientService } from '../ia/ia-client.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { descifrar } from '../common/utils/encriptado.util';
import { enviarWhatsappTwilio } from '../common/utils/twilio-whatsapp.util';
import { fechaHoyRD } from '../common/utils/zona-horaria-rd.util';

const MENSAJE_LIMITE_ALCANZADO = 'Alcanzamos el límite de respuestas automáticas de hoy — un representante te va a contactar pronto.';
const MENSAJE_SIN_IA = 'El asistente automático no está disponible en este momento — un representante te va a contactar pronto.';
const MENSAJE_FALLBACK = 'Dejame conectarte con alguien del equipo, un momento por favor.';

const PROMPT_SCAFFOLDING = `Sos un asistente virtual de atención al cliente por WhatsApp.
Respondé ÚNICAMENTE con un JSON válido, sin texto adicional antes o después, con este formato exacto:
{"respuesta": "texto de tu respuesta al cliente", "requiereHumano": true o false}
Nunca inventes ni afirmes datos de facturas, pedidos, saldos o cuentas de clientes — no tenés acceso a esa información. Si te preguntan algo así, o el cliente pide hablar con una persona, o no podés resolver la consulta, marcá "requiereHumano": true y respondé que un representante lo va a contactar.`;

interface ConfigBot {
  tenantId: string;
  twilioAccountSid: string | null;
  twilioAuthTokenCifrado: string | null;
  twilioWhatsappFrom: string | null;
  iaModelo: string | null;
  iaApiKeyCifrado: string | null;
  iaPromptNegocio: string | null;
  historialMensajes: number;
  limiteRespuestasDiarias: number;
}

/**
 * Orquesta el bot conversacional de WhatsApp (ítem H-2b) — el webhook
 * (`WhatsappWebhookController`) solo parsea la petición y delega acá.
 */
@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappMensajesRepository: WhatsappMensajesRepository,
    private readonly iaClientService: IaClientService,
    private readonly eventBus: EventBusService,
  ) {}

  /** `to` tal cual lo manda Twilio (prefijo `whatsapp:` incluido) — se normaliza acá antes de buscar. */
  async resolverConfigPorNumero(to: string) {
    const numero = to.replace(/^whatsapp:/, '');
    return this.prisma.whatsappConfigTenant.findUnique({ where: { twilioWhatsappFrom: numero } });
  }

  verificarFirma(config: { twilioAuthTokenCifrado: string | null }, urlCompleta: string, params: Record<string, string>, firma: string | undefined): boolean {
    if (!config.twilioAuthTokenCifrado) return false;
    return verificarFirmaTwilio(urlCompleta, params, firma, descifrar(config.twilioAuthTokenCifrado));
  }

  /** `from` tal cual lo manda Twilio (prefijo `whatsapp:` incluido) — es el remitente, el cliente. */
  async procesarMensajeEntrante(config: ConfigBot, from: string, body: string) {
    const { tenantId } = config;
    const diaRD = fechaHoyRD();

    const mensajeEntrante = await this.whatsappMensajesRepository.crear({ tenantId, telefono: from, rol: 'USUARIO', contenido: body, diaRD });

    const respuestasHoy = await this.whatsappMensajesRepository.contarRespuestasHoy(tenantId, diaRD);
    if (respuestasHoy >= config.limiteRespuestasDiarias) {
      await this.responderYEscalar(config, from, diaRD, mensajeEntrante.id, MENSAJE_LIMITE_ALCANZADO);
      return;
    }

    if (!config.iaApiKeyCifrado) {
      this.logger.warn(`Tenant ${tenantId} tiene el bot habilitado pero sin iaApiKeyCifrado configurada`);
      await this.responderYEscalar(config, from, diaRD, mensajeEntrante.id, MENSAJE_SIN_IA);
      return;
    }

    const historial = await this.whatsappMensajesRepository.historialReciente(tenantId, from, config.historialMensajes);
    const mensajes = [
      ...historial
        .filter((m) => m.id !== mensajeEntrante.id)
        .map((m) => ({ role: (m.rol === 'USUARIO' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.contenido })),
      { role: 'user' as const, content: body },
    ];

    const system = config.iaPromptNegocio
      ? `${PROMPT_SCAFFOLDING}\n\nInformación del negocio (provista por el negocio, no la inventes ni la contradigas):\n${config.iaPromptNegocio}`
      : PROMPT_SCAFFOLDING;

    const textoIa = await this.iaClientService.completarConversacion(mensajes, {
      apiKey: descifrar(config.iaApiKeyCifrado),
      modelo: config.iaModelo ?? undefined,
      system,
    });

    const { respuesta, requiereHumano } = this.parsearRespuestaIa(textoIa);

    await this.whatsappMensajesRepository.crear({ tenantId, telefono: from, rol: 'ASISTENTE', contenido: respuesta, diaRD });

    if (requiereHumano) {
      await this.marcarYNotificar(tenantId, mensajeEntrante.id, from);
    }

    await this.enviarRespuesta(config, from, respuesta);
  }

  private async responderYEscalar(config: ConfigBot, from: string, diaRD: string, mensajeEntranteId: string, mensaje: string) {
    await this.whatsappMensajesRepository.crear({ tenantId: config.tenantId, telefono: from, rol: 'ASISTENTE', contenido: mensaje, diaRD });
    await this.marcarYNotificar(config.tenantId, mensajeEntranteId, from);
    await this.enviarRespuesta(config, from, mensaje);
  }

  private async marcarYNotificar(tenantId: string, mensajeId: string, telefono: string) {
    await this.prisma.whatsappMensaje.update({ where: { id: mensajeId }, data: { requiereAtencionHumana: true } });
    this.eventBus.emit(EVENTOS.WHATSAPP_REQUIERE_ATENCION, { tenantId, mensajeId, telefono });
  }

  /** `to` (destinatario, el cliente) tal cual lo manda Twilio en `From` del webhook original — se le quita el prefijo acá, `enviarWhatsappTwilio` se lo vuelve a poner. */
  private async enviarRespuesta(config: ConfigBot, to: string, body: string) {
    if (!config.twilioAccountSid || !config.twilioAuthTokenCifrado || !config.twilioWhatsappFrom) {
      this.logger.error('No se pudo responder por WhatsApp — faltan credenciales de Twilio del tenant');
      return;
    }
    const enviado = await enviarWhatsappTwilio({
      accountSid: config.twilioAccountSid,
      authToken: descifrar(config.twilioAuthTokenCifrado),
      from: `whatsapp:${config.twilioWhatsappFrom}`,
      to: to.replace(/^whatsapp:/, ''),
      body,
    });
    if (!enviado) this.logger.error(`Twilio respondió con error al contestar a ${to}`);
  }

  private parsearRespuestaIa(texto: string | null): { respuesta: string; requiereHumano: boolean } {
    if (!texto) return { respuesta: MENSAJE_FALLBACK, requiereHumano: true };
    try {
      const parseado = JSON.parse(texto) as { respuesta?: unknown; requiereHumano?: unknown };
      if (typeof parseado.respuesta === 'string') {
        return { respuesta: parseado.respuesta, requiereHumano: Boolean(parseado.requiereHumano) };
      }
    } catch {
      // sigue al fallback de abajo
    }
    this.logger.warn('La IA no devolvió el JSON esperado — fail-safe a requiereHumano');
    return { respuesta: MENSAJE_FALLBACK, requiereHumano: true };
  }
}
