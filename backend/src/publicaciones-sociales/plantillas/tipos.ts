import type { Image, SKRSContext2D } from '@napi-rs/canvas';

/** Lado de salida del banner — cuadrado, formato universal de feed (reels/historias quedan para la fase de video). */
export const LADO_BANNER = 1080;

export interface DatosBannerProducto {
  productoNombre: string;
  precioFormateado: string;
  imagenProducto: Image;
  /** `undefined` si el tenant no configuró un logo — toda plantilla debe tolerarlo sin romper. */
  logoTenant?: Image;
}

export type FuncionPlantilla = (ctx: SKRSContext2D, datos: DatosBannerProducto) => void;
