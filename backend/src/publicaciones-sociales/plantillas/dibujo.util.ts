import type { Image, SKRSContext2D } from '@napi-rs/canvas';

/**
 * Dibuja `imagen` recortada a `(x,y,w,h)` con ajuste "cover" (llena todo
 * el rectángulo sin deformar, recortando el sobrante) — mismo criterio
 * visual que `Producto.imagenAjuste = COVER` en la Tienda Online.
 */
export function dibujarImagenCover(ctx: SKRSContext2D, imagen: Image, x: number, y: number, w: number, h: number) {
  const escala = Math.max(w / imagen.width, h / imagen.height);
  const anchoDestino = imagen.width * escala;
  const altoDestino = imagen.height * escala;
  const offsetX = x + (w - anchoDestino) / 2;
  const offsetY = y + (h - altoDestino) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(imagen, offsetX, offsetY, anchoDestino, altoDestino);
  ctx.restore();
}

/** Corta `texto` con "…" si no entra en `maxWidth` con la fuente ya seteada en `ctx` — sin wrap, una sola línea (suficiente para nombre de producto en un banner). */
export function truncarTexto(ctx: SKRSContext2D, texto: string, maxWidth: number): string {
  if (ctx.measureText(texto).width <= maxWidth) return texto;
  let recortado = texto;
  while (recortado.length > 1 && ctx.measureText(`${recortado}…`).width > maxWidth) {
    recortado = recortado.slice(0, -1);
  }
  return `${recortado}…`;
}

/** Reduce el tamaño de fuente hasta que `texto` entre en `anchoMax` (nunca truncar un precio) — deja `ctx.font` ya seteado al tamaño elegido. */
export function fijarFuenteQueEntra(ctx: SKRSContext2D, texto: string, familia: string, tamanioInicial: number, anchoMax: number, minimo = 24): number {
  let tamanio = tamanioInicial;
  while (tamanio > minimo) {
    ctx.font = `${tamanio}px ${familia}`;
    if (ctx.measureText(texto).width <= anchoMax) break;
    tamanio -= 2;
  }
  return tamanio;
}

/** Círculo blanco de fondo para que un logo con transparencia (o de cualquier color) siempre contraste, sea cual sea la foto detrás. */
export function dibujarChipLogo(ctx: SKRSContext2D, logo: Image, cx: number, cy: number, radio: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.clip();
  const lado = radio * 2 * 0.72;
  dibujarImagenCover(ctx, logo, cx - lado / 2, cy - lado / 2, lado, lado);
  ctx.restore();
}
