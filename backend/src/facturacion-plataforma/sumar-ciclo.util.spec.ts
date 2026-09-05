import { sumarCiclo, sumarCiclos } from './sumar-ciclo.util';

describe('sumarCiclo', () => {
  it('MENSUAL suma un mes', () => {
    expect(sumarCiclo(new Date('2026-01-15T00:00:00Z'), 'MENSUAL').toISOString()).toContain('2026-02-15');
  });

  it('MENSUAL hace rollover de año en diciembre', () => {
    expect(sumarCiclo(new Date('2026-12-15T00:00:00Z'), 'MENSUAL').toISOString()).toContain('2027-01-15');
  });

  it('ANUAL suma un año', () => {
    expect(sumarCiclo(new Date('2026-03-10T00:00:00Z'), 'ANUAL').toISOString()).toContain('2027-03-10');
  });

  it('no muta la fecha original', () => {
    const original = new Date('2026-01-15T00:00:00Z');
    sumarCiclo(original, 'MENSUAL');
    expect(original.toISOString()).toContain('2026-01-15');
  });
});

describe('sumarCiclos', () => {
  it('MENSUAL × N suma N meses (pago adelantado de varios meses)', () => {
    expect(sumarCiclos(new Date('2026-01-15T00:00:00Z'), 'MENSUAL', 6).toISOString()).toContain('2026-07-15');
  });

  it('ANUAL × N suma N años (pago adelantado de varios años)', () => {
    expect(sumarCiclos(new Date('2026-03-10T00:00:00Z'), 'ANUAL', 2).toISOString()).toContain('2028-03-10');
  });

  it('N=1 se comporta igual que sumarCiclo', () => {
    const fecha = new Date('2026-06-01T00:00:00Z');
    expect(sumarCiclos(fecha, 'MENSUAL', 1).toISOString()).toBe(sumarCiclo(fecha, 'MENSUAL').toISOString());
  });

  it('no muta la fecha original', () => {
    const original = new Date('2026-01-15T00:00:00Z');
    sumarCiclos(original, 'MENSUAL', 6);
    expect(original.toISOString()).toContain('2026-01-15');
  });
});
