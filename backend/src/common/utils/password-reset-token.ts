import { createHash, randomBytes } from 'crypto';

export const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000;

export function generarTokenReset() {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashearTokenReset(token) };
}

export function hashearTokenReset(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
