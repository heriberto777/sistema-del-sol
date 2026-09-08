import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { OpenAiFondoAdapter } from './openai-fondo.adapter';
import { GeminiFondoAdapter } from './gemini-fondo.adapter';
import { GeneradorFondoAdapter, ImagenReferencia, ModeloIa } from './generador-fondo.interface';

/** Claude no participa — no genera imágenes. */
export const PROVEEDORES_IA_FONDO = ['openai', 'gemini'] as const;
export type ProveedorIaFondo = (typeof PROVEEDORES_IA_FONDO)[number];

const PATRON_DATA_URI = /^data:(image\/[a-z]+);base64,(.+)$/;

/**
 * Único punto que sabe qué proveedor de generación de FONDO está activo
 * (`IA_FONDO_PROVEEDOR_ACTIVO`) — mismo criterio que
 * `AnalizadorImagenService`, pero para Publicaciones Sociales Fase 2.
 * Selector y modelos independientes de `AnalizadorImagenService`
 * porque son familias de modelo distintas (generación de imagen vs.
 * vision/chat), aunque reusan las mismas API keys de plataforma.
 */
@Injectable()
export class GeneradorFondoService {
  constructor(
    private readonly openAiAdapter: OpenAiFondoAdapter,
    private readonly geminiAdapter: GeminiFondoAdapter,
  ) {}

  private get adaptadores(): Record<ProveedorIaFondo, GeneradorFondoAdapter> {
    return { openai: this.openAiAdapter, gemini: this.geminiAdapter };
  }

  get activo(): GeneradorFondoAdapter {
    const clave = (process.env.IA_FONDO_PROVEEDOR_ACTIVO || 'gemini') as ProveedorIaFondo;
    return this.adaptadores[clave] ?? this.geminiAdapter;
  }

  /** Lista de modelos reales de UN proveedor puntual (no necesariamente el activo) — para el selector de `/plataforma/configuración`. */
  async listarModelos(proveedor: string): Promise<ModeloIa[]> {
    const adapter = this.adaptadores[proveedor as ProveedorIaFondo];
    if (!adapter) throw new BadRequestException(`Proveedor "${proveedor}" no reconocido para generación de fondo`);
    return adapter.listarModelos();
  }

  /**
   * `dataUriProducto` es la foto REAL del producto (`Producto.imagen`).
   * Desde la Fase 3, `prompt` ya trae el precio/oferta reales como
   * texto y el resultado de esta llamada ES la imagen final — no hay
   * overlay de Canvas después (a diferencia de la Fase 2). `logoDataUri`
   * (opcional) es el logo del tenant, pasado como segunda imagen de
   * referencia para que la IA lo incluya nítido en el diseño.
   */
  async generarDesdeDataUri(dataUriProducto: string, prompt: string, logoDataUri?: string): Promise<string> {
    const match = PATRON_DATA_URI.exec(dataUriProducto);
    if (!match) throw new BadRequestException('La foto del producto no tiene un formato válido');
    const [, mimeType, base64] = match;

    let logo: ImagenReferencia | undefined;
    if (logoDataUri) {
      const matchLogo = PATRON_DATA_URI.exec(logoDataUri);
      if (matchLogo) logo = { mimeType: matchLogo[1], base64: matchLogo[2] };
    }

    const adapter = this.activo;
    if (!adapter.habilitado) {
      throw new ServiceUnavailableException(`Generar fondo con IA no está disponible todavía (proveedor "${adapter.clave}" sin configurar)`);
    }
    const resultado = logo ? await adapter.generar(base64, mimeType, prompt, logo) : await adapter.generar(base64, mimeType, prompt);
    return `data:${resultado.mimeType};base64,${resultado.base64}`;
  }
}
