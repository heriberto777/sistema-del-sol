import type { SKRSContext2D } from '@napi-rs/canvas';
import { LADO_BANNER, type FuncionPlantilla } from './tipos';
import { dibujarImagenCover, dibujarChipLogo, truncarTexto, fijarFuenteQueEntra } from './dibujo.util';

const ALTO_PLACA = 220;

/** Foto a sangre completa, logo del tenant en una esquina, nombre+precio en una placa semitransparente inferior. */
export const dibujarMinimalista: FuncionPlantilla = (ctx: SKRSContext2D, datos) => {
  dibujarImagenCover(ctx, datos.imagenProducto, 0, 0, LADO_BANNER, LADO_BANNER);

  if (datos.logoTenant) {
    dibujarChipLogo(ctx, datos.logoTenant, 96, 96, 56);
  }

  const yPlaca = LADO_BANNER - ALTO_PLACA;
  ctx.fillStyle = 'rgba(17, 24, 39, 0.62)';
  ctx.fillRect(0, yPlaca, LADO_BANNER, ALTO_PLACA);

  const paddingX = 64;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F3F4F6';
  ctx.font = '34px Inter';
  ctx.fillText(truncarTexto(ctx, datos.productoNombre, LADO_BANNER - paddingX * 2), paddingX, yPlaca + 84);

  ctx.fillStyle = '#FFFFFF';
  fijarFuenteQueEntra(ctx, datos.precioFormateado, 'Inter Bold', 64, LADO_BANNER - paddingX * 2);
  ctx.fillText(datos.precioFormateado, paddingX, yPlaca + 160);
};
