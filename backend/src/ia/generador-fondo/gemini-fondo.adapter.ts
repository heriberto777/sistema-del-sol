import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { GeneradorFondoAdapter, ImagenGenerada, ModeloIa } from './generador-fondo.interface';

/**
 * `generateContent` de Gemini con `responseModalities: ['IMAGE']`
 * (`gemini-3-pro-image-preview`, "Nano Banana Pro" — familia distinta a
 * los modelos de vision/texto de `gemini-vision.adapter.ts`) — mismo
 * `fetch` directo y misma forma de pasar la key por query param que el
 * resto de adapters de Gemini de este proyecto.
 */
@Injectable()
export class GeminiFondoAdapter implements GeneradorFondoAdapter {
  private readonly logger = new Logger(GeminiFondoAdapter.name);
  readonly clave = 'gemini' as const;

  get habilitado(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async generar(imagenBase64: string, mimeType: string, prompt: string): Promise<ImagenGenerada> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Generar fondo con IA no está disponible todavía (falta configurar Gemini)');
    }

    const modelo = process.env.GEMINI_IMAGEN_MODEL || 'gemini-3-pro-image-preview';
    let respuesta: Response;
    try {
      respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imagenBase64 } }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      });
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de Gemini (fondo)', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a Gemini — intenta de nuevo en unos minutos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`Gemini respondió ${respuesta.status} al generar el fondo: ${detalle}`);
      throw new ServiceUnavailableException('Gemini no pudo generar el fondo — probá con otro prompt o con OpenAI');
    }

    const cuerpo = (await respuesta.json()) as {
      candidates?: { content?: { parts?: { inline_data?: { data?: string; mime_type?: string } }[] } }[];
    };
    const parte = cuerpo.candidates?.[0]?.content?.parts?.find((p) => p.inline_data?.data);
    if (!parte?.inline_data?.data) throw new ServiceUnavailableException('Gemini no devolvió ninguna imagen');
    return { base64: parte.inline_data.data, mimeType: parte.inline_data.mime_type || 'image/png' };
  }

  /** Más estricto que `gemini-vision.adapter.ts` (que solo filtra por `generateContent`) — acá además exige "image" en el nombre, para no traer modelos de solo-texto que también soportan `generateContent`. */
  async listarModelos(): Promise<ModeloIa[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Guarda primero la API key de Gemini para poder listar sus modelos');

    let respuesta: Response;
    try {
      respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    } catch (error) {
      this.logger.error('Fallo al listar modelos de generación de imagen de Gemini', error as Error);
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
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /image/i.test(m.name))
      .map((m) => ({ id: m.name.replace(/^models\//, ''), nombre: m.displayName || m.name }));
  }
}
