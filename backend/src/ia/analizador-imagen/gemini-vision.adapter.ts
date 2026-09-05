import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AnalizadorImagenAdapter, CandidatoProducto, ModeloIa } from './analizador-imagen.interface';
import { construirPromptAnalizarProducto, parsearCandidatos } from './analizador-imagen.prompt';

/**
 * Generative Language API de Google (Gemini 2.0 Flash, visión) — `fetch`
 * directo, sin el SDK oficial. A diferencia de Claude/OpenAI, Gemini
 * recibe la API key como query param (`?key=...`), no en un header.
 */
@Injectable()
export class GeminiVisionAdapter implements AnalizadorImagenAdapter {
  private readonly logger = new Logger(GeminiVisionAdapter.name);
  readonly clave = 'gemini';

  get habilitado(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async analizar(imagenBase64: string, mimeType: string, detalle?: string): Promise<CandidatoProducto[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Generar con IA no está disponible todavía (falta configurar Gemini)');
    }

    const modelo = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    let respuesta: Response;
    try {
      respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: construirPromptAnalizarProducto(detalle) }, { inline_data: { mime_type: mimeType, data: imagenBase64 } }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
    } catch (error) {
      this.logger.error('Fallo al llamar a la API de Gemini', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a Gemini — intenta de nuevo en unos minutos');
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      this.logger.error(`Gemini respondió ${respuesta.status} al analizar la imagen: ${detalle}`);
      throw new ServiceUnavailableException('Gemini no pudo analizar la imagen');
    }

    const cuerpo = (await respuesta.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const texto = cuerpo.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    if (!texto) throw new ServiceUnavailableException('Gemini no devolvió ningún resultado');
    return parsearCandidatos(texto, 'Gemini');
  }

  async listarModelos(): Promise<ModeloIa[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Guarda primero la API key de Gemini para poder listar sus modelos');

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
