import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITMO = 'aes-256-gcm';
const SAL_DERIVACION = 'sistema-del-sol-plataforma-config';

/**
 * AES-256-GCM con `crypto` nativo (sin dependencia nueva) para guardar
 * secretos de integraciones (Stripe, SMTP, Twilio) en
 * PlataformaConfiguracion — nunca en texto plano. La clave real sale de
 * ENCRYPTION_KEY (env), derivada a 32 bytes con scrypt; un IV random por
 * valor cifrado, el authTag va concatenado (formato `iv.authTag.cifrado`,
 * cada parte en base64).
 */
function obtenerClave(): Buffer {
  const secreto = process.env.ENCRYPTION_KEY;
  if (!secreto) {
    throw new Error('Falta ENCRYPTION_KEY — necesaria para guardar configuración sensible de plataforma');
  }
  return scryptSync(secreto, SAL_DERIVACION, 32);
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, obtenerClave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, cifrado].map((buffer) => buffer.toString('base64')).join('.');
}

export function descifrar(valor: string): string {
  const [ivB64, authTagB64, cifradoB64] = valor.split('.');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const cifrado = Buffer.from(cifradoB64, 'base64');

  const decipher = createDecipheriv(ALGORITMO, obtenerClave(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
}
