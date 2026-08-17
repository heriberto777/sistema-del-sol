import { MODULOS_BASE, PLANES_BASE } from './modulos-base';

describe('modulos-base', () => {
  it('todo módulo referenciado en un plan existe en el catálogo MODULOS_BASE', () => {
    const catalogo = new Set(MODULOS_BASE.map((m) => m.clave));
    for (const plan of Object.values(PLANES_BASE)) {
      for (const clave of plan.modulos) {
        expect(catalogo.has(clave)).toBe(true);
      }
      expect(plan.modulos.length).toBeGreaterThan(0);
    }
  });

  it('Premium incluye todos los módulos de Profesional, y Profesional todos los de Básico', () => {
    const basico = new Set(PLANES_BASE['Básico'].modulos);
    const profesional = new Set(PLANES_BASE['Profesional'].modulos);
    const premium = new Set(PLANES_BASE['Premium'].modulos);

    for (const clave of basico) expect(profesional.has(clave)).toBe(true);
    for (const clave of profesional) expect(premium.has(clave)).toBe(true);
  });

  it('no hay claves de módulo duplicadas en el catálogo', () => {
    const claves = MODULOS_BASE.map((m) => m.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
