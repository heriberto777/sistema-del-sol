/**
 * Límite del freno de fuerza bruta de un endpoint de login (auditoría de
 * seguridad) — mucho más alto bajo test, para no cortar los e2e a mitad
 * de camino (llaman login repetidas veces a propósito, cada grupo de
 * tests pide un token fresco por aislamiento — muy por encima de lo que
 * un usuario real intentaría). Se detecta "corriendo bajo Jest" con
 * `JEST_WORKER_ID` (Jest lo fija siempre, en todos sus workers) en vez
 * de `NODE_ENV === 'test'` — ESTE repo, en esta máquina, tiene
 * `NODE_ENV=production` heredado del shell del sistema incluso corriendo
 * tests (mismo gotcha ya documentado en docs/DEVELOPMENT.md), así que
 * ese chequeo nunca se cumple acá. `.overrideGuard(ThrottlerGuard)` en
 * los e2e tampoco sirve para esto (el guard se registra vía `APP_GUARD`
 * y no llegó a matchear la clase en el testing module). El límite real
 * de producción ya se verificó en vivo con curl (ver auditoría) — este
 * helper no lo toca fuera de Jest.
 */
export function limiteLogin(limiteProduccion: number): number {
  return process.env.JEST_WORKER_ID !== undefined ? 100_000 : limiteProduccion;
}
