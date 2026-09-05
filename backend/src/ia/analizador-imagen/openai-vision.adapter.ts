import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AnalizadorImagenAdapter, CandidatoProducto, ModeloIa } from './analizador-imagen.interface';
import { construirPromptAnalizarProducto, parsearCandidatos } from './analizador-imagen.prompt';

/**
 * Chat Completions API de OpenAI (GPT-4o, tiene visión) — `fetch` directo,
 * sin el SDK oficial `openai`, mismo criterio que el resto de adaptadores
 * de este proyecto (un solo POST no lo justifica).
 */
@Injectable()
export class OpenAiVisionAdapter implements AnalizadorImagenAdapter {
  private readonly logger = new Logger(OpenAiVisionAdapter.name);
  readonly clave = 'openai';

  get habilitado(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async analizar(imagenBase64: string, mimeType: string, detalle?: string): Promise<CandidatoProducto[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Generar con IA no está disponible todavía (falta configurar OpenAI)');
    }

    let respuesta: Response;
    try {
      respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          max_tokens: 1024,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: construirPromptAnalizarProducto(detalle) },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imagenBase64}` } },
              ],
            },
          ],
        }),
      });
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de OpenAI', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a OpenAI — intenta de nuevo en unos minutos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`OpenAI respondió ${respuesta.status} al analizar la imagen: ${detalle}`);
      throw new ServiceUnavailableException('OpenAI no pudo analizar la imagen');
    }

    const cuerpo = (await respuesta.json()) as { choices?: { message?: { content?: string } }[] };
    const texto = cuerpo.choices?.[0]?.message?.content;
    if (!texto) throw new ServiceUnavailableException('OpenAI no devolvió ningún resultado');
    return parsearCandidatos(texto, 'OpenAI');
  }

  /**
   * `GET /v1/models` de OpenAI devuelve TODO el catálogo (embeddings,
   * whisper, tts, dall-e, moderation, versiones -instruct viejas, etc.),
   * sin ninguna bandera de "soporta visión" — se filtra por familia
   * conocida (gpt-4, gpt-5, o1, o3, o4, chatgpt) y se descartan sufijos
   * que se sabe que no son de chat. Es un filtro heurístico, no una
   * garantía — sigue siendo mejor que texto libre porque al menos son
   * modelos reales que existen para esta cuenta.
   */
  async listarModelos(): Promise<ModeloIa[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Guarda primero la API key de OpenAI para poder listar sus modelos');

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
