import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { OpenAiFondoAdapter } from './openai-fondo.adapter';
import { GeminiFondoAdapter } from './gemini-fondo.adapter';
import { GeneradorFondoAdapter, ModeloIa } from './generador-fondo.interface';

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
   * `dataUriProducto` es la foto REAL del producto (`Producto.imagen`) —
   * el resultado es un nuevo data URI con el mismo producto en un fondo/
   * ambientación distinta según `prompt`, para que el motor de Canvas de
   * Publicaciones Sociales (Fase 1) dibuje el texto/precio encima igual
   * que si fuera la foto original.
   */
  async generarDesdeDataUri(dataUriProducto: string, prompt: string): Promise<string> {
    const match = PATRON_DATA_URI.exec(dataUriProducto);
    if (!match) throw new BadRequestException('La foto del producto no tiene un formato válido');
    const [, mimeType, base64] = match;

    const adapter = this.activo;
    if (!adapter.habilitado) {
      throw new ServiceUnavailableException(`Generar fondo con IA no está disponible todavía (proveedor "${adapter.clave}" sin configurar)`);
    }
    const resultado = await adapter.generar(base64, mimeType, prompt);
    return `data:${resultado.mimeType};base64,${resultado.base64}`;
  }
}
