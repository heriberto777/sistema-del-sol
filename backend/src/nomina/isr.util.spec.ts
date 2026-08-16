import { calcularIsrMensual } from './isr.util';

describe('calcularIsrMensual', () => {
  it('tramo exento: no retiene nada por debajo de RD$416,220 anual', () => {
    expect(calcularIsrMensual(20000)).toBe(0);
  });

  it('segundo tramo (15%): salario mensual que anualizado cae entre 416,220 y 624,329', () => {
    // anual = 540,000 -> (540000-416220)*0.15 = 18,567 -> mensual 1,547.25
    expect(calcularIsrMensual(45000)).toBeCloseTo(1547.25, 2);
  });

  it('tercer tramo (20%): salario mensual que anualizado cae entre 624,329 y 867,123', () => {
    // anual = 720,000 -> 31,216 + (720000-624329)*0.2 = 50,350.2 -> mensual 4,195.85
    expect(calcularIsrMensual(60000)).toBeCloseTo(4195.85, 2);
  });

  it('cuarto tramo (25%): salario mensual que anualizado supera 867,123', () => {
    // anual = 1,200,000 -> 79,776 + (1200000-867123)*0.25 = 162,995.25 -> mensual 13,582.9375
    expect(calcularIsrMensual(100000)).toBeCloseTo(13582.94, 2);
  });

  it('nunca retiene un monto negativo', () => {
    expect(calcularIsrMensual(0)).toBe(0);
  });
});
