import { cifrar, descifrar } from './encriptado.util';

describe('encriptado.util', () => {
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba-no-usar-en-produccion';
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  it('descifra exactamente lo que se cifró (round-trip)', () => {
    const original = 'sk_test_abc123XYZ';
    expect(descifrar(cifrar(original))).toBe(original);
  });

  it('el mismo texto cifrado dos veces produce ciphertext distinto (IV random)', () => {
    const a = cifrar('mismo-secreto');
    const b = cifrar('mismo-secreto');
    expect(a).not.toBe(b);
    expect(descifrar(a)).toBe('mismo-secreto');
    expect(descifrar(b)).toBe('mismo-secreto');
  });

  it('lanza si falta ENCRYPTION_KEY al cifrar', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => cifrar('x')).toThrow(/ENCRYPTION_KEY/);
  });

  it('lanza si falta ENCRYPTION_KEY al descifrar', () => {
    const valor = cifrar('x');
    delete process.env.ENCRYPTION_KEY;
    expect(() => descifrar(valor)).toThrow(/ENCRYPTION_KEY/);
  });

  it('descifrar con la clave equivocada falla (no devuelve basura silenciosamente)', () => {
    const valor = cifrar('secreto');
    process.env.ENCRYPTION_KEY = 'otra-clave-completamente-distinta';
    expect(() => descifrar(valor)).toThrow();
  });
});
