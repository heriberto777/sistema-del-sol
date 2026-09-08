import type { SKRSContext2D } from '@napi-rs/canvas';
import { LADO_BANNER, type FuncionPlantilla } from './tipos';
import { dibujarImagenCover, truncarTexto, fijarFuenteQueEntra } from './dibujo.util';

const ALTO_FOTO = Math.round(LADO_BANNER * 0.7);
const ALTO_BANDA = LADO_BANNER - ALTO_FOTO;

/** Foto a sangre en el 70% superior, banda sólida de marca en el 30% inferior con nombre + precio grande. */
export const dibujarPrecioDestacado: FuncionPlantilla = (ctx: SKRSContext2D, datos) => {
  dibujarImagenCover(ctx, datos.imagenProducto, 0, 0, LADO_BANNER, ALTO_FOTO);

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, ALTO_FOTO, LADO_BANNER, ALTO_BANDA);

  const centroX = LADO_BANNER / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#E5E7EB';
  ctx.font = '38px Inter';
  ctx.fillText(truncarTexto(ctx, datos.productoNombre, LADO_BANNER - 120), centroX, ALTO_FOTO + 66);

  ctx.fillStyle = '#FFFFFF';
  fijarFuenteQueEntra(ctx, datos.precioFormateado, 'Inter Bold', 84, LADO_BANNER - 120);
  ctx.fillText(datos.precioFormateado, centroX, ALTO_FOTO + 172);
};
