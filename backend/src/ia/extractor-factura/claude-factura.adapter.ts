import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ExtractorFacturaAdapter, FacturaExtraida } from './extractor-factura.interface';
import { PROMPT_EXTRAER_FACTURA, parsearFacturaExtraida } from './extractor-factura.prompt';

/**
 * Misma API/credencial que `ClaudeVisionAdapter` (Anthropic Messages API,
 * `ANTHROPIC_API_KEY`) — adapter aparte porque la forma de salida es otra
 * (un objeto estructurado, no una lista de candidatos) y porque acá SÍ
 * hace falta soportar PDF (una factura de proveedor llega casi siempre
 * como PDF por email, a diferencia de la foto de un producto). Anthropic
 * soporta PDF nativo con un bloque `type: 'document'` en vez de `type:
 * 'image'` — mismo `source.data` en base64, el `media_type` decide cuál
 * de los dos mandar.
 */
@Injectable()
export class ClaudeFacturaAdapter implements ExtractorFacturaAdapter {
  private readonly logger = new Logger(ClaudeFacturaAdapter.name);
  readonly clave = 'claude';

  get habilitado(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async extraer(archivoBase64: string, mimeType: string): Promise<FacturaExtraida> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Crear desde imagen/PDF no está disponible todavía (falta configurar Claude)');
    }

    const esPdf = mimeType === 'application/pdf';
    const bloqueArchivo = esPdf
      ? { type: 'document', source: { type: 'base64', media_type: mimeType, data: archivoBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: archivoBase64 } };

    let respuesta: Response;
    try {
      respuesta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
          max_tokens: 1024,
          messages: [{ role: 'user', content: [bloqueArchivo, { type: 'text', text: PROMPT_EXTRAER_FACTURA }] }],
        }),
      });
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de Anthropic (extracción de factura)', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a Claude — intenta de nuevo en unos minutos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`Anthropic respondió ${respuesta.status} al extraer la factura: ${detalle}`);
      throw new ServiceUnavailableException('Claude no pudo leer el archivo');
    }

    const cuerpo = (await respuesta.json()) as { content?: { type: string; text?: string }[] };
    const texto = cuerpo.content?.find((bloque) => bloque.type === 'text')?.text;
    if (!texto) throw new ServiceUnavailableException('Claude no devolvió ningún resultado');
    return parsearFacturaExtraida(texto, 'Claude');
  }
}
