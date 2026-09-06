import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConversacionIaAdapter, MensajeConversacion, OpcionesConversacionIa } from './conversacion-ia.interface';
import { ModeloIa } from '../analizador-imagen/analizador-imagen.interface';

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

  async listarModelos(apiKey: string): Promise<ModeloIa[]> {
    let respuesta: Response;
    try {
      respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    } catch (error) {
      this.logger.error('Fallo al listar modelos de Gemini', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a Gemini para listar los modelos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`Gemini respondió ${respuesta.status} al listar modelos: ${detalle}`);
      throw new ServiceUnavailableException('Gemini no pudo devolver la lista de modelos — revisa la API key');
    }

    const cuerpo = (await respuesta.json()) as {
      models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
    };
    return (cuerpo.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => ({ id: m.name.replace(/^models\//, ''), nombre: m.displayName || m.name }));
  }
}
