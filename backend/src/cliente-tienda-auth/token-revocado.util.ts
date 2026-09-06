import { createHash } from 'crypto';

const PREFIJO_CLAVE = 'cliente-tienda-token-revocado:';

/**
 * Blacklist de tokens de cliente de tienda en Redis (auditoría de
 * seguridad 2026-09-06: el token dura 30 días sin ningún mecanismo de
 * revocación — "cerrar sesión" solo borraba el token del lado del
 * navegador, el JWT seguía siendo válido en el servidor hasta que
 * expirara solo). No se guarda el token crudo como clave (sha256 en
 * hex, más corto y no reversible); Redis expira la entrada solo
 * (`EX segundosRestantes`), nunca crece sin límite.
 */
export function claveTokenRevocado(tokenCrudo: string): string {
  return PREFIJO_CLAVE + createHash('sha256').update(tokenCrudo).digest('hex');
}

/** `exp` (segundos Unix) del JWT sin verificar la firma — quien llama ya pasó por el guard, que sí la verificó. `null` si el token no trae `exp` o no es un JWT bien formado. */
export function segundosHastaExpirar(tokenCrudo: string): number | null {
  try {
    const [, payloadB64] = tokenCrudo.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { exp?: unknown };
    if (typeof payload.exp !== 'number') return null;
    return Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
  } catch {
    return null;
  }
}
