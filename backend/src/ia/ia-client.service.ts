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
}
