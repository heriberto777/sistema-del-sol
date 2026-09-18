const PLACEHOLDERS = new Set([
  'cambia-este-secreto-en-produccion',
  'cambia-este-secreto-de-plataforma-en-produccion',
  'cambia-este-secreto-de-cliente-tienda-en-produccion',
]);

/**
 * Recuerda qué valor resolvió cada nombre de variable en este proceso —
 * para poder detectar, más abajo, si dos dominios de auth DISTINTOS
 * (JWT_SECRET/PLATFORM_JWT_SECRET/CLIENTE_TIENDA_JWT_SECRET) terminaron
 * con el mismo secreto real. Nunca se limpia (vive todo el proceso, se
 * llena una sola vez durante el bootstrap de Nest) — es justo lo que
 * hace falta para esta comparación cruzada.
 */
const secretosResueltos = new Map<string, string>();

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
 *
 * Además valida que este secreto no coincida con el de OTRO dominio de
 * auth ya resuelto en este mismo proceso (defensa en profundidad, ítem
 * bajo de la auditoría de RBAC: hoy un JWT de tenant no podría pasar
 * PlatformPermissionsGuard igual porque los permisos de plataforma
 * siempre llevan el prefijo "platform.", pero si dos secretos
 * coincidieran por error de configuración, un JWT firmado para un
 * dominio verificaría también contra la estrategia del otro — mejor
 * cortarlo en el arranque que confiar solo en esa mitigación indirecta).
 */
export function obtenerSecretoJwt(nombreVariable: string): string {
  const valor = process.env[nombreVariable];
  if (!valor || PLACEHOLDERS.has(valor)) {
    throw new Error(`Falta configurar ${nombreVariable} en .env — generá un valor real y random, nunca el placeholder de .env.example`);
  }
  for (const [otraVariable, otroValor] of secretosResueltos) {
    if (otraVariable !== nombreVariable && otroValor === valor) {
      throw new Error(`${nombreVariable} tiene el mismo valor que ${otraVariable} — cada secreto JWT debe ser único y random, nunca compartido entre dominios de auth`);
    }
  }
  secretosResueltos.set(nombreVariable, valor);
  return valor;
}
