import { Injectable, Logger } from '@nestjs/common';
import { ConversacionIaAdapter, MensajeConversacion, OpcionesConversacionIa } from './conversacion-ia.interface';

/**
 * Chat Completions API de OpenAI — a diferencia de Anthropic, el prompt
 * de sistema va como un mensaje más (`role: 'system'`) al principio del
 * array, no en un campo separado.
 */
@Injectable()
export class OpenAiConversacionAdapter implements ConversacionIaAdapter {
  private readonly logger = new Logger(OpenAiConversacionAdapter.name);
  readonly clave = 'OPENAI';

  async completar(mensajes: MensajeConversacion[], opciones: OpcionesConversacionIa): Promise<string | null> {
    try {
      const respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${opciones.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opciones.modelo || 'gpt-4o',
          max_tokens: opciones.maxTokens ?? 1024,
          messages: [...(opciones.system ? [{ role: 'system', content: opciones.system }] : []), ...mensajes],
        }),
      });

      if (!respuesta.ok) {
        this.logger.error(`OpenAI respondió ${respuesta.status} al pedir una completación de conversación`);
        return null;
      }

      const cuerpo = (await respuesta.json()) as { choices?: { message?: { content?: string } }[] };
      return cuerpo.choices?.[0]?.message?.content ?? null;
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de OpenAI (conversación)', error as Error);
      return null;
    }
  }
}
