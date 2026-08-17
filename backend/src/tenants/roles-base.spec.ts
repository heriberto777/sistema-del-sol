import { PERMISOS_BASE, ROLES_BASE, CONFIGURACIONES_BASE } from './roles-base';

describe('roles-base', () => {
  it('todo permiso referenciado en un rol existe en el catálogo PERMISOS_BASE', () => {
    const catalogo = new Set(PERMISOS_BASE);
    for (const permisos of Object.values(ROLES_BASE)) {
      for (const permiso of permisos) {
        expect(catalogo.has(permiso)).toBe(true);
      }
      expect(permisos.length).toBeGreaterThan(0);
    }
  });

  it('Admin Total tiene todos los permisos del catálogo', () => {
    expect(new Set(ROLES_BASE['Admin Total'])).toEqual(new Set(PERMISOS_BASE));
  });

  it('ningún rol salvo Admin Total tiene permisos admin.*', () => {
    for (const [rol, permisos] of Object.entries(ROLES_BASE)) {
      if (rol === 'Admin Total') continue;
      expect(permisos.some((p) => p.startsWith('admin.'))).toBe(false);
    }
  });

  it('CONFIGURACIONES_BASE trae los parámetros esperados por el resto del sistema', () => {
    expect(CONFIGURACIONES_BASE).toEqual(
      expect.objectContaining({
        ITBIS_GENERAL: '18',
        ITBIS_REDUCIDA: '8',
        PLAZO_PAGO_DIAS: '30',
        STOCK_MINIMO_DEFAULT: '10',
        RETENCION_ISR_TASA: '15',
        RETENCION_ITBIS_TASA: '30',
        POS_TOLERANCIA_ARQUEO: '50',
      }),
    );
  });
});
