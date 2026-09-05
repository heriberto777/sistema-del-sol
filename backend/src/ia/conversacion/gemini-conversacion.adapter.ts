import { Injectable, Logger } from '@nestjs/common';
import { ConversacionIaAdapter, MensajeConversacion, OpcionesConversacionIa } from './conversacion-ia.interface';

/**
 * Generative Language API de Google — dos diferencias con Anthropic/
 * OpenAI: la key va como query param (no header), y el rol "assistant"
 * se llama "model" en el array `contents`.
 */
@Injectable()
export class GeminiConversacionAdapter implements ConversacionIaAdapter {
  private readonly logger = new Logger(GeminiConversacionAdapter.name);
  readonly clave = 'GEMINI';

  async completar(mensajes: MensajeConversacion[], opciones: OpcionesConversacionIa): Promise<string | null> {
    const modelo = opciones.modelo || 'gemini-2.0-flash';
    try {
      const respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${opciones.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(opciones.system ? { systemInstruction: { parts: [{ text: opciones.system }] } } : {}),
          contents: mensajes.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: opciones.maxTokens ?? 1024 },
        }),
      });

      if (!respuesta.ok) {
        this.logger.error(`Gemini respondió ${respuesta.status} al pedir una completación de conversación`);
        return null;
      }

      const cuerpo = (await respuesta.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return cuerpo.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? null;
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de Gemini (conversación)', error as Error);
      return null;
    }
  }
}
