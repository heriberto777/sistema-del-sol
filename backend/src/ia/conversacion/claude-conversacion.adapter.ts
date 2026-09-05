import { Injectable, Logger } from '@nestjs/common';
import { ConversacionIaAdapter, MensajeConversacion, OpcionesConversacionIa } from './conversacion-ia.interface';

/**
 * Anthropic Messages API — misma llamada que ya usaba
 * `IaClientService.completarConversacion` (movida acá para que el bot de
 * WhatsApp pueda elegir entre varios proveedores, ver ConversacionIaService).
 * `fetch` directo, sin SDK, mismo criterio que el resto de adaptadores.
 */
@Injectable()
export class ClaudeConversacionAdapter implements ConversacionIaAdapter {
  private readonly logger = new Logger(ClaudeConversacionAdapter.name);
  readonly clave = 'ANTHROPIC';

  async completar(mensajes: MensajeConversacion[], opciones: OpcionesConversacionIa): Promise<string | null> {
    try {
      const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': opciones.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opciones.modelo || 'claude-sonnet-5',
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
      return cuerpo.content?.find((bloque) => bloque.type === 'text')?.text ?? null;
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de Anthropic (conversación)', error as Error);
      return null;
    }
  }
}
