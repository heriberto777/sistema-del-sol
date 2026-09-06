import { claveTokenRevocado, segundosHastaExpirar } from './token-revocado.util';

describe('claveTokenRevocado', () => {
  it('siempre arma la misma clave para el mismo token (determinístico)', () => {
    expect(claveTokenRevocado('abc.def.ghi')).toBe(claveTokenRevocado('abc.def.ghi'));
  });

  it('nunca guarda el token crudo en la clave', () => {
    expect(claveTokenRevocado('token-secreto-crudo')).not.toContain('token-secreto-crudo');
  });

  it('tokens distintos arman claves distintas', () => {
    expect(claveTokenRevocado('token-a')).not.toBe(claveTokenRevocado('token-b'));
  });
});

describe('segundosHastaExpirar', () => {
  function tokenConExp(exp: number): string {
    const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
    return `header.${payload}.firma`;
  }

  it('calcula los segundos restantes a partir de exp', () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const segundos = segundosHastaExpirar(tokenConExp(exp));
    expect(segundos).not.toBeNull();
    expect(segundos!).toBeGreaterThan(110);
    expect(segundos!).toBeLessThanOrEqual(120);
  });

  it('nunca devuelve 0 o negativo (mínimo 1) aunque el token ya haya expirado', () => {
    const exp = Math.floor(Date.now() / 1000) - 3600;
    expect(segundosHastaExpirar(tokenConExp(exp))).toBe(1);
  });

  it('null si el token no es un JWT bien formado', () => {
    expect(segundosHastaExpirar('esto-no-es-un-jwt')).toBeNull();
  });

  it('null si el payload no trae exp', () => {
    const payload = Buffer.from(JSON.stringify({ clienteId: 'c1' })).toString('base64url');
    expect(segundosHastaExpirar(`header.${payload}.firma`)).toBeNull();
  });
});
