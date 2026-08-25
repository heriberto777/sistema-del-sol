import { calcularHashAzul, compararHashesAzul, formatearMontoAzul } from './azul-hash.util';

describe('calcularHashAzul', () => {
  it('es determinístico para los mismos campos y clave', () => {
    const campos = ['99999999999', 'Comercio', 'ECommerce', '$', '1234', '15000', '000'];
    const hash1 = calcularHashAzul(campos, 'clave-secreta');
    const hash2 = calcularHashAzul(campos, 'clave-secreta');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{128}$/); // SHA-512 = 64 bytes = 128 hex chars
  });

  it('cambia si cambia cualquier campo', () => {
    const base = ['99999999999', 'Comercio', 'ECommerce', '$', '1234', '15000', '000'];
    const modificado = [...base.slice(0, -1), '999']; // ITBIS distinto
    expect(calcularHashAzul(base, 'clave-secreta')).not.toBe(calcularHashAzul(modificado, 'clave-secreta'));
  });

  it('cambia si cambia la clave', () => {
    const campos = ['99999999999', 'Comercio', 'ECommerce', '$', '1234', '15000', '000'];
    expect(calcularHashAzul(campos, 'clave-a')).not.toBe(calcularHashAzul(campos, 'clave-b'));
  });
});

describe('compararHashesAzul', () => {
  it('acepta hashes iguales', () => {
    const hash = calcularHashAzul(['a', 'b'], 'k');
    expect(compararHashesAzul(hash, hash)).toBe(true);
  });

  it('rechaza un hash alterado', () => {
    const hash = calcularHashAzul(['a', 'b'], 'k');
    const alterado = hash.slice(0, -2) + (hash.slice(-2) === '00' ? '11' : '00');
    expect(compararHashesAzul(hash, alterado)).toBe(false);
  });

  it('rechaza vacío', () => {
    expect(compararHashesAzul('', '')).toBe(false);
  });

  it('rechaza longitudes distintas sin lanzar', () => {
    expect(compararHashesAzul('ab', 'abcd')).toBe(false);
  });
});

describe('formatearMontoAzul', () => {
  it('convierte a centavos sin coma ni punto', () => {
    expect(formatearMontoAzul(10)).toBe('1000');
    expect(formatearMontoAzul(17483.21)).toBe('1748321');
    expect(formatearMontoAzul(0)).toBe('0');
  });
});
