import { ModeloIa } from '../analizador-imagen/analizador-imagen.interface';

export { ModeloIa };

/** Imagen cruda devuelta por el proveedor — se re-empaqueta como data URI en `GeneradorFondoService`. */
export interface ImagenGenerada {
  base64: string;
  mimeType: string;
}

/** Imagen de entrada adicional (Fase 3 — logo del tenant) sin el prefijo `data:...;base64,`, ya separado por quien llama. */
export interface ImagenReferencia {
  base64: string;
  mimeType: string;
}

/**
 * Un adaptador por proveedor de generación de FONDO de imagen (no
 * vision/análisis — ver `AnalizadorImagenAdapter` para eso). Solo
 * OpenAI/Gemini implementan esto — Claude no genera imágenes, por eso
 * no hay `ClaudeFondoAdapter`. Mismo criterio de interfaz que
 * `AnalizadorImagenAdapter`: ni el controller ni el resto del sistema
 * conocen cuál está detrás.
 */
export interface GeneradorFondoAdapter {
  readonly clave: 'openai' | 'gemini';
  readonly habilitado: boolean;
  /**
   * `imagenBase64` (sin el prefijo `data:...;base64,`) es la foto REAL
   * del producto. `logo` (Fase 3, opcional) es una segunda imagen de
   * referencia — el logo del tenant, para que la IA lo incluya nítido
   * en el diseño. El `prompt` (Fase 3) ya trae el precio/oferta reales
   * como texto — la IA diseña la pieza completa, no solo el fondo.
   */
  generar(imagenBase64: string, mimeType: string, prompt: string, logo?: ImagenReferencia): Promise<ImagenGenerada>;
  /** Modelos de generación de imagen reales de esta cuenta — familia distinta a los modelos de vision/chat de `AnalizadorImagenAdapter.listarModelos()`. */
  listarModelos(): Promise<ModeloIa[]>;
}
