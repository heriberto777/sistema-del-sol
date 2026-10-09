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

  // Fechas construidas en hora LOCAL (sin sufijo "Z") a propósito — `sumarCiclo`
  // opera con getDate/setMonth/setFullYear locales, igual que el resto del
  // archivo; parsear con "Z" y comparar vía toISOString() puede correrse un
  // día según el huso horario de la máquina que corre el test, justo en los
  // casos límite que estos tests existen para cubrir.
  it('MENSUAL desde el 31 de enero clampea a 28 de febrero (2026, no bisiesto) en vez de saltar a marzo', () => {
    const resultado = sumarCiclo(new Date(2026, 0, 31), 'MENSUAL');
    expect([resultado.getFullYear(), resultado.getMonth(), resultado.getDate()]).toEqual([2026, 1, 28]);
  });

  it('MENSUAL desde el 31 de enero clampea a 29 de febrero en un año bisiesto (2028)', () => {
    const resultado = sumarCiclo(new Date(2028, 0, 31), 'MENSUAL');
    expect([resultado.getFullYear(), resultado.getMonth(), resultado.getDate()]).toEqual([2028, 1, 29]);
  });

  it('MENSUAL desde el 30 de marzo clampea a 30 de abril (mes corto de 30)', () => {
    const resultado = sumarCiclo(new Date(2026, 2, 30), 'MENSUAL');
    expect([resultado.getFullYear(), resultado.getMonth(), resultado.getDate()]).toEqual([2026, 3, 30]);
  });

  it('MENSUAL desde un día que SÍ existe en el mes destino no se recorta', () => {
    const resultado = sumarCiclo(new Date(2026, 1, 28), 'MENSUAL');
    expect([resultado.getFullYear(), resultado.getMonth(), resultado.getDate()]).toEqual([2026, 2, 28]);
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

  it('MENSUAL × N desde el 31 de enero clampea al último día de cada mes destino, sin arrastrar el recorte entre ciclos', () => {
    // 31 ene + 3 = 30 abr (abril tiene 30 días) — clampea sobre el día
    // ORIGINAL (31) cada vez, no sobre el resultado ya recortado del paso
    // anterior (si arrastrara, 31→28(feb)→28(mar) en vez de 31→31(mar)).
    const resultado = sumarCiclos(new Date(2026, 0, 31), 'MENSUAL', 3);
    expect([resultado.getFullYear(), resultado.getMonth(), resultado.getDate()]).toEqual([2026, 3, 30]);
  });
});
