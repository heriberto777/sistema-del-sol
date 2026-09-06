import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConversacionIaAdapter, MensajeConversacion, OpcionesConversacionIa } from './conversacion-ia.interface';
import { ModeloIa } from '../analizador-imagen/analizador-imagen.interface';

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

  /** Mismo filtro heurístico que OpenAiVisionAdapter.listarModelos — GET /v1/models no distingue familias de chat del resto del catálogo. */
  async listarModelos(apiKey: string): Promise<ModeloIa[]> {
    let respuesta: Response;
    try {
      respuesta = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch (error) {
      this.logger.error('Fallo al listar modelos de OpenAI', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a OpenAI para listar los modelos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`OpenAI respondió ${respuesta.status} al listar modelos: ${detalle}`);
      throw new ServiceUnavailableException('OpenAI no pudo devolver la lista de modelos — revisa la API key');
    }

    const cuerpo = (await respuesta.json()) as { data?: { id: string }[] };
    const ids = (cuerpo.data ?? [])
      .map((m) => m.id)
      .filter((id) => /^(gpt-4|gpt-5|chatgpt|o1|o3|o4)/.test(id) && !/(audio|realtime|transcribe|tts|instruct|search|embedding)/.test(id))
      .sort();
    return ids.map((id) => ({ id, nombre: id }));
  }
}
