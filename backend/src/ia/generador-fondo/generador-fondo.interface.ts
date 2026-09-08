import { ModeloIa } from '../analizador-imagen/analizador-imagen.interface';

export { ModeloIa };

/** Imagen cruda devuelta por el proveedor — se re-empaqueta como data URI en `GeneradorFondoService`. */
export interface ImagenGenerada {
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
   * del producto — el proveedor la reinterpreta/ambienta según `prompt`,
   * nunca dibuja texto/precio (eso lo hace el motor de Canvas después,
   * con el resultado de esta llamada como nueva "foto de fondo").
   */
  generar(imagenBase64: string, mimeType: string, prompt: string): Promise<ImagenGenerada>;
  /** Modelos de generación de imagen reales de esta cuenta — familia distinta a los modelos de vision/chat de `AnalizadorImagenAdapter.listarModelos()`. */
  listarModelos(): Promise<ModeloIa[]>;
}
