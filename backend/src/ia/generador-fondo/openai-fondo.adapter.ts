import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { FormatoFondo, GeneradorFondoAdapter, ImagenGenerada, ImagenReferencia, ModeloIa } from './generador-fondo.interface';

const EXTENSION_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * `images.edit` de OpenAI (`gpt-image-1.5`/`gpt-image-2` — familia
 * "gpt-image", distinta a los modelos de chat/vision de
 * `openai-vision.adapter.ts`) — `fetch` directo, sin el SDK oficial,
 * mismo criterio que el resto de adaptadores. A diferencia de los demás
 * adapters de IA de este proyecto, el request es `multipart/form-data`
 * (la imagen va como archivo binario, no base64 inline) — sin máscara:
 * edición libre guiada solo por `prompt`, reinterpreta toda la imagen.
 */
@Injectable()
export class OpenAiFondoAdapter implements GeneradorFondoAdapter {
  private readonly logger = new Logger(OpenAiFondoAdapter.name);
  readonly clave = 'openai' as const;

  get habilitado(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async generar(imagenBase64: string, mimeType: string, prompt: string, formato: FormatoFondo, logo?: ImagenReferencia): Promise<ImagenGenerada> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Generar fondo con IA no está disponible todavía (falta configurar OpenAI)');
    }

    const extension = EXTENSION_POR_MIME[mimeType] ?? 'png';
    const form = new FormData();
    form.append('model', process.env.OPENAI_IMAGEN_MODEL || 'gpt-image-1.5');
    form.append('prompt', prompt);
    // `images.edit` no soporta 9:16 exacto — 1024x1536 es la aproximación portrait (2:3) más cercana que ofrece.
    form.append('size', formato === 'VERTICAL' ? '1024x1536' : '1024x1024');
    // `image[]` (campo repetido, no uno nuevo) — images.edit acepta
    // varias imágenes de referencia; la segunda es el logo del tenant.
    form.append('image[]', new Blob([Buffer.from(imagenBase64, 'base64')], { type: mimeType }), `producto.${extension}`);
    if (logo) {
      const extensionLogo = EXTENSION_POR_MIME[logo.mimeType] ?? 'png';
      form.append('image[]', new Blob([Buffer.from(logo.base64, 'base64')], { type: logo.mimeType }), `logo.${extensionLogo}`);
    }

    let respuesta: Response;
    try {
      respuesta = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de OpenAI (fondo)', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a OpenAI — intenta de nuevo en unos minutos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`OpenAI respondió ${respuesta.status} al generar el fondo: ${detalle}`);
      throw new ServiceUnavailableException('OpenAI no pudo generar el fondo — probá con otro prompt o con Gemini');
    }

    const cuerpo = (await respuesta.json()) as { data?: { b64_json?: string }[] };
    const base64 = cuerpo.data?.[0]?.b64_json;
    if (!base64) throw new ServiceUnavailableException('OpenAI no devolvió ninguna imagen');
    return { base64, mimeType: 'image/png' };
  }

  /** `gpt-image-*` queda EXCLUIDO a propósito del allowlist de `openai-vision.adapter.ts` (es chat/vision, no generación) — acá es al revés: solo esa familia. */
  async listarModelos(): Promise<ModeloIa[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Guarda primero la API key de OpenAI para poder listar sus modelos');

    let respuesta: Response;
    try {
      respuesta = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch (error) {
      this.logger.error('Fallo al listar modelos de generación de imagen de OpenAI', error as Error);
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
      .filter((id) => /^gpt-image/.test(id))
      .sort();
    return ids.map((id) => ({ id, nombre: id }));
  }
}
