import { aFecha } from './fecha-input.util';

describe('aFecha', () => {
  it('convierte "YYYY-MM-DD" (lo que manda un <input type="date">) a un Date real', () => {
    const resultado = aFecha('2026-09-07');
    expect(resultado).toBeInstanceOf(Date);
    expect((resultado as Date).toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });

  it('acepta también un ISO-8601 completo', () => {
    const resultado = aFecha('2026-09-07T15:30:00.000Z');
    expect(resultado).toBeInstanceOf(Date);
  });

  it('null pasa igual (limpiar el campo en un update)', () => {
    expect(aFecha(null)).toBeNull();
  });

  it('undefined pasa igual (campo no enviado — Prisma lo omite del update)', () => {
    expect(aFecha(undefined)).toBeUndefined();
  });
});
