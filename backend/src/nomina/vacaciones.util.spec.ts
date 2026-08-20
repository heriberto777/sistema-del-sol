import { calcularBalanceVacaciones, contarDiasNoDomingo } from './vacaciones.util';

describe('calcularBalanceVacaciones', () => {
  it('empleado con menos de 1 año de antigüedad no acumula ningún día', () => {
    const balance = calcularBalanceVacaciones(new Date('2026-01-15T00:00:00.000Z'), 0, new Date('2026-08-20T00:00:00.000Z'));

    expect(balance.aniosCompletos).toBe(0);
    expect(balance.diasAcumulados).toBe(0);
    expect(balance.diasDisponibles).toBe(0);
  });

  it('exactamente 1 año cumplido acumula 14 días, pagados a 14 días de salario', () => {
    const balance = calcularBalanceVacaciones(new Date('2025-08-20T00:00:00.000Z'), 0, new Date('2026-08-20T00:00:00.000Z'));

    expect(balance.aniosCompletos).toBe(1);
    expect(balance.diasAcumulados).toBe(14);
    expect(balance.diasDisponibles).toBe(14);
    expect(balance.diasPagoPorAntiguedad).toBe(14);
  });

  it('un día antes del aniversario todavía cuenta el año anterior (no redondea para arriba)', () => {
    const balance = calcularBalanceVacaciones(new Date('2025-08-20T00:00:00.000Z'), 0, new Date('2026-08-19T00:00:00.000Z'));

    expect(balance.aniosCompletos).toBe(0);
  });

  it('descuenta los días ya tomados del balance disponible', () => {
    const balance = calcularBalanceVacaciones(new Date('2023-01-01T00:00:00.000Z'), 20, new Date('2026-06-01T00:00:00.000Z'));

    expect(balance.aniosCompletos).toBe(3);
    expect(balance.diasAcumulados).toBe(42);
    expect(balance.diasDisponibles).toBe(22);
  });

  it('a partir de 5 años de antigüedad, el pago sube a 18 días de salario (Art. 178) sin cambiar los días de descanso', () => {
    const balance = calcularBalanceVacaciones(new Date('2020-01-01T00:00:00.000Z'), 0, new Date('2026-06-01T00:00:00.000Z'));

    expect(balance.aniosCompletos).toBe(6);
    expect(balance.diasAcumulados).toBe(84);
    expect(balance.diasPagoPorAntiguedad).toBe(18);
  });
});

describe('contarDiasNoDomingo', () => {
  it('cuenta un rango de 7 días excluyendo el único domingo', () => {
    const dias = contarDiasNoDomingo(new Date('2026-08-21T00:00:00.000Z'), new Date('2026-08-27T00:00:00.000Z'));

    expect(dias).toBe(6);
  });

  it('un solo día que no es domingo cuenta 1', () => {
    const dias = contarDiasNoDomingo(new Date('2026-08-21T00:00:00.000Z'), new Date('2026-08-21T00:00:00.000Z'));

    expect(dias).toBe(1);
  });

  it('un solo día que es domingo cuenta 0', () => {
    const dias = contarDiasNoDomingo(new Date('2026-08-23T00:00:00.000Z'), new Date('2026-08-23T00:00:00.000Z'));

    expect(dias).toBe(0);
  });
});
