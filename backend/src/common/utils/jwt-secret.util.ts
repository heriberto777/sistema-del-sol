const PLACEHOLDERS = new Set([
  'cambia-este-secreto-en-produccion',
  'cambia-este-secreto-de-plataforma-en-produccion',
  'cambia-este-secreto-de-cliente-tienda-en-produccion',
]);

/**
 * Lee un secreto JWT desde env y aborta el arranque si falta o si sigue
 * siendo el placeholder de `.env.example` — antes cada uno de los 3
 * dominios de auth (tenant/plataforma/cliente-tienda) caía a ese mismo
 * placeholder con `?? '...'` si la env var faltaba, sin ningún chequeo
 * (bug de seguridad real, encontrado en auditoría: cualquiera que lea
 * el código fuente puede forjar un JWT válido, incluido uno de
 * super-admin de plataforma, si un despliegue arranca sin rotar estos
 * secretos). Mismo criterio que `encriptado.util.ts` con
 * `ENCRYPTION_KEY` — se llama desde código que corre durante el
 * bootstrap de Nest (`JwtModule.register`, constructores de estrategia,
 * constantes de módulo), así que el `throw` para el arranque completo
 * en vez de fallar silenciosamente en el primer login.
 */
export function obtenerSecretoJwt(nombreVariable: string): string {
  const valor = process.env[nombreVariable];
  if (!valor || PLACEHOLDERS.has(valor)) {
    throw new Error(`Falta configurar ${nombreVariable} en .env — generá un valor real y random, nunca el placeholder de .env.example`);
  }
  return valor;
}
