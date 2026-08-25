import { Injectable, Logger } from '@nestjs/common';

/**
 * Cliente crudo (fetch directo, sin el SDK oficial de Anthropic — mismo
 * criterio que WhatsAppChannel con Twilio: es un solo POST, no justifica
 * una dependencia nueva) a la Messages API de Claude. Sin
 * `ANTHROPIC_API_KEY` configurada, `completar()` devuelve `null` y quien
 * llama cae a un modo heurístico sin IA — mismo patrón de degradación
 * que EmailChannel/WhatsAppChannel: nada se rompe en desarrollo sin la
 * credencial, solo se pierde la parte "inteligente" de la respuesta.
 */
@Injectable()
export class IaClientService {
  private readonly logger = new Logger(IaClientService.name);

  get habilitado(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async completar(prompt: string, maxTokens = 1024): Promise<string | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY no configurada — respuesta de IA omitida (modo heurístico)');
      return null;
    }

    try {
      const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!respuesta.ok) {
        this.logger.error(`Anthropic respondió ${respuesta.status} al pedir una completación`);
        return null;
      }

      const cuerpo = (await respuesta.json()) as { content?: { type: string; text?: string }[] };
      const texto = cuerpo.content?.find((bloque) => bloque.type === 'text')?.text;
      return texto ?? null;
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de Anthropic', error as Error);
      return null;
    }
  }

  /**
   * Variante multi-turno de `completar()` — usada por el bot de WhatsApp
   * (ítem H-2b), que necesita mandar el historial de la conversación, no
   * un solo prompt. `opciones.apiKey`/`modelo` permiten usar la clave
   * propia de un tenant (`WhatsappConfigTenant.iaApiKeyCifrado`,
   * descifrada por quien llama) en vez de la de plataforma — a propósito
   * NO cae a `ANTHROPIC_API_KEY` si no viene una explícita, para no
   * cobrarle a la plataforma el uso de IA de un tenant que no configuró
   * la suya.
   */
  async completarConversacion(
    mensajes: { role: 'user' | 'assistant'; content: string }[],
    opciones: { apiKey?: string; modelo?: string; maxTokens?: number; system?: string } = {},
  ): Promise<string | null> {
    const apiKey = opciones.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.warn('Sin API key de Anthropic (ni de tenant ni de plataforma) — completarConversacion omitida');
      return null;
    }

    try {
      const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opciones.modelo || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
          max_tokens: opciones.maxTokens ?? 1024,
          // Anthropic usa un campo `system` separado del array `messages`
          // (a diferencia de OpenAI, que mete un mensaje con role "system"
          // adentro del mismo array) — ver
          // https://docs.anthropic.com/en/api/messages.
          ...(opciones.system ? { system: opciones.system } : {}),
          messages: mensajes,
        }),
      });

      if (!respuesta.ok) {
        this.logger.error(`Anthropic respondió ${respuesta.status} al pedir una completación de conversación`);
        return null;
      }

      const cuerpo = (await respuesta.json()) as { content?: { type: string; text?: string }[] };
      const texto = cuerpo.content?.find((bloque) => bloque.type === 'text')?.text;
      return texto ?? null;
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de Anthropic (conversación)', error as Error);
      return null;
    }
  }
}
