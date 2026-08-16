import { lookup } from 'dns/promises';
import { isIP } from 'net';

const RANGOS_PRIVADOS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
  /^::1$/,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe80:/i,
];

function esIpPrivada(ip: string): boolean {
  return RANGOS_PRIVADOS.some((rango) => rango.test(ip));
}

/**
 * Valida que la URL de un webhook de tenant no apunte a infraestructura
 * interna (SSRF). Solo permite http/https y resuelve el host para
 * rechazar IPs privadas/loopback/link-local.
 */
export async function validarUrlWebhook(url: string): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('El webhook debe usar http o https');
  }

  const hostname = parsed.hostname;
  if (hostname === 'localhost') {
    throw new Error('No se permite localhost como destino de webhook');
  }

  const ip = isIP(hostname) ? hostname : (await lookup(hostname)).address;
  if (esIpPrivada(ip)) {
    throw new Error('No se permite una IP privada/interna como destino de webhook');
  }
}
