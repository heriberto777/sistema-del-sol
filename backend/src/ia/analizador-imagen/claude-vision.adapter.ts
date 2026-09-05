import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AnalizadorImagenAdapter, CandidatoProducto, ModeloIa } from './analizador-imagen.interface';
import { PROMPT_ANALIZAR_PRODUCTO, parsearCandidatos } from './analizador-imagen.prompt';

/**
 * Misma API/credencial que `IaClientService` (Anthropic Messages API,
 * `ANTHROPIC_API_KEY`) — acá aparte porque el análisis de imagen usa un
 * `content` con bloques `image`+`text` en vez de un string plano, forma
 * que `IaClientService.completar()` no soporta. `fetch` directo, sin SDK
 * — mismo criterio que el resto del proyecto (Stripe/NPM/Twilio).
 */
@Injectable()
export class ClaudeVisionAdapter implements AnalizadorImagenAdapter {
  private readonly logger = new Logger(ClaudeVisionAdapter.name);
  readonly clave = 'claude';

  get habilitado(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async analizar(imagenBase64: string, mimeType: string): Promise<CandidatoProducto[]> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Generar con IA no está disponible todavía (falta configurar Claude)');
    }

    let respuesta: Response;
    try {
      respuesta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mimeType, data: imagenBase64 } },
                { type: 'text', text: PROMPT_ANALIZAR_PRODUCTO },
              ],
            },
          ],
        }),
      });
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de Anthropic (visión)', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a Claude — intenta de nuevo en unos minutos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`Anthropic respondió ${respuesta.status} al analizar la imagen: ${detalle}`);
      throw new ServiceUnavailableException('Claude no pudo analizar la imagen');
    }

    const cuerpo = (await respuesta.json()) as { content?: { type: string; text?: string }[] };
    const texto = cuerpo.content?.find((bloque) => bloque.type === 'text')?.text;
    if (!texto) throw new ServiceUnavailableException('Claude no devolvió ningún resultado');
    return parsearCandidatos(texto, 'Claude');
  }

  async listarModelos(): Promise<ModeloIa[]> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Guarda primero la API key de Claude para poder listar sus modelos');

    let respuesta: Response;
    try {
      respuesta = await fetch('https://api.anthropic.com/v1/models?limit=100', {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      });
    } catch (error) {
      this.logger.error('Fallo al listar modelos de Anthropic', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a Claude para listar los modelos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`Anthropic respondió ${respuesta.status} al listar modelos: ${detalle}`);
      throw new ServiceUnavailableException('Claude no pudo devolver la lista de modelos — revisa la API key');
    }

    const cuerpo = (await respuesta.json()) as { data?: { id: string; display_name?: string }[] };
    return (cuerpo.data ?? []).map((m) => ({ id: m.id, nombre: m.display_name || m.id }));
  }
}
