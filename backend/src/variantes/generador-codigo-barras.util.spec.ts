import { calcularDigitoVerificadorEan13, esEan13Valido, generarCode128Interno, generarEan13Interno } from './generador-codigo-barras.util';

describe('generador-codigo-barras.util', () => {
  describe('calcularDigitoVerificadorEan13', () => {
    it('calcula el dígito verificador correcto contra códigos EAN-13 reales conocidos', () => {
      // Kinder Sorpresa — dígito verificador real: 1
      expect(calcularDigitoVerificadorEan13('400638133393')).toBe(1);
      // Ejemplo estándar de referencia GS1 — dígito verificador real: 7
      expect(calcularDigitoVerificadorEan13('590123412345')).toBe(7);
    });
  });

  describe('generarEan13Interno', () => {
    it('arma un código de 13 dígitos con prefijo "20" reservado por GS1 para uso interno', () => {
      const codigo = generarEan13Interno(42);
      expect(codigo).toHaveLength(13);
      expect(codigo.startsWith('20')).toBe(true);
      expect(codigo.slice(2, 12)).toBe('0000000042');
    });

    it('el código generado siempre pasa la validación de EAN-13', () => {
      expect(esEan13Valido(generarEan13Interno(1))).toBe(true);
      expect(esEan13Valido(generarEan13Interno(9999999999))).toBe(true);
      expect(esEan13Valido(generarEan13Interno(0))).toBe(true);
    });
  });

  describe('generarCode128Interno', () => {
    it('arma un código con prefijo "INT" y el secuencial con padding a 10 dígitos', () => {
      expect(generarCode128Interno(7)).toBe('INT0000000007');
    });

    it('un código Code128 interno nunca pasa la validación de EAN-13 (no es numérico)', () => {
      expect(esEan13Valido(generarCode128Interno(1))).toBe(false);
    });
  });

  describe('esEan13Valido', () => {
    it('true para EAN-13 reales conocidos', () => {
      expect(esEan13Valido('4006381333931')).toBe(true);
      expect(esEan13Valido('5901234123457')).toBe(true);
    });

    it('false si no tiene exactamente 13 dígitos', () => {
      expect(esEan13Valido('123')).toBe(false);
      expect(esEan13Valido('12345678901234')).toBe(false);
      expect(esEan13Valido('')).toBe(false);
    });

    it('false si contiene caracteres no numéricos', () => {
      expect(esEan13Valido('INT0000000007')).toBe(false);
      expect(esEan13Valido('400638133393X')).toBe(false);
    });

    it('false si el dígito verificador es incorrecto', () => {
      expect(esEan13Valido('4006381333930')).toBe(false); // debería terminar en 1
    });
  });
});
