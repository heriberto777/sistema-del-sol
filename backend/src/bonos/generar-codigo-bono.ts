// Alfabeto sin caracteres fácilmente confundibles al transcribir a mano
// (sin O/0, I/1) — un bono se imprime o se lee en voz alta al cajero.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** `BONO-XXXXXXXX` (8 chars del alfabeto seguro) — ~32^8 combinaciones, de sobra para no colisionar dentro de un mismo lote (ver BonosService.emitirLote, que igual reintenta contra el Set de códigos ya generados en esa corrida). */
export function generarCodigoBono(): string {
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return `BONO-${codigo}`;
}
