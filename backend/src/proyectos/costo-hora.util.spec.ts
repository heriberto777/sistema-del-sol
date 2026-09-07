import { costoHora } from './costo-hora.util';

describe('costoHora', () => {
  it('divide el salario mensual entre las horas laborables del mes', () => {
    expect(costoHora(34666, 173.33)).toBeCloseTo(200, 1);
  });

  it('acepta strings (como vienen de Prisma.Decimal serializado)', () => {
    expect(costoHora('34666', '173.33')).toBeCloseTo(200, 1);
  });

  it('devuelve 0 en vez de Infinity/NaN si las horas laborables son 0', () => {
    expect(costoHora(30000, 0)).toBe(0);
  });
});
