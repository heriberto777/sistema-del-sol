import { sumarCiclo } from './sumar-ciclo.util';

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
