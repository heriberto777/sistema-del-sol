import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AnalizadorImagenAdapter, CandidatoProducto } from './analizador-imagen.interface';
import { PROMPT_ANALIZAR_PRODUCTO, parsearCandidatos } from './analizador-imagen.prompt';

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

  async analizar(imagenBase64: string, mimeType: string): Promise<CandidatoProducto[]> {
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
                { type: 'text', text: PROMPT_ANALIZAR_PRODUCTO },
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
}
