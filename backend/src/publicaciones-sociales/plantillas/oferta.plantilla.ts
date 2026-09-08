import type { SKRSContext2D } from '@napi-rs/canvas';
import { LADO_BANNER, type FuncionPlantilla } from './tipos';
import { dibujarImagenCover, truncarTexto, fijarFuenteQueEntra } from './dibujo.util';

const MARGEN = 90;
const FOTO_X = MARGEN;
const FOTO_Y = MARGEN;
const FOTO_LADO = LADO_BANNER - MARGEN * 2;
const ROJO = '#DC2626';

/** Foto centrada con margen, cinta diagonal "OFERTA" en la esquina, precio en un badge circular superpuesto, nombre debajo. */
export const dibujarOferta: FuncionPlantilla = (ctx: SKRSContext2D, datos) => {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, LADO_BANNER, LADO_BANNER);

  dibujarImagenCover(ctx, datos.imagenProducto, FOTO_X, FOTO_Y, FOTO_LADO, FOTO_LADO);

  // Cinta diagonal en la esquina superior izquierda de la foto.
  ctx.save();
  ctx.translate(FOTO_X + 30, FOTO_Y + 30);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = ROJO;
  ctx.fillRect(-190, -28, 380, 56);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '30px Inter Bold';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OFERTA', 0, 2);
  ctx.restore();

  // Badge circular con el precio, superpuesto a la esquina inferior derecha de la foto.
  const cx = FOTO_X + FOTO_LADO - 10;
  const cy = FOTO_Y + FOTO_LADO - 10;
  const radio = 110;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.fillStyle = ROJO;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fijarFuenteQueEntra(ctx, datos.precioFormateado, 'Inter Bold', 40, radio * 1.6);
  ctx.fillText(datos.precioFormateado, cx, cy);
  ctx.restore();

  // Nombre del producto centrado debajo de la foto.
  const yNombre = FOTO_Y + FOTO_LADO + 70;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111827';
  ctx.font = '40px Inter Bold';
  ctx.fillText(truncarTexto(ctx, datos.productoNombre, LADO_BANNER - MARGEN * 2), LADO_BANNER / 2, yNombre);
};
