import { PERMISOS_PLATAFORMA_BASE, ROLES_PLATAFORMA_BASE } from './platform-roles-base';

describe('platform-roles-base', () => {
  it('todo permiso referenciado en un rol existe en el catálogo PERMISOS_PLATAFORMA_BASE', () => {
    const catalogo = new Set(PERMISOS_PLATAFORMA_BASE);
    for (const permisos of Object.values(ROLES_PLATAFORMA_BASE)) {
      for (const permiso of permisos) {
        expect(catalogo.has(permiso)).toBe(true);
      }
      expect(permisos.length).toBeGreaterThan(0);
    }
  });

  it('Super Admin tiene todos los permisos del catálogo', () => {
    expect(new Set(ROLES_PLATAFORMA_BASE['Super Admin'])).toEqual(new Set(PERMISOS_PLATAFORMA_BASE));
  });

  it('no hay claves duplicadas en el catálogo', () => {
    expect(new Set(PERMISOS_PLATAFORMA_BASE).size).toBe(PERMISOS_PLATAFORMA_BASE.length);
  });

  it('ningún rol salvo Super Admin puede gestionar otros admins de plataforma', () => {
    for (const [rol, permisos] of Object.entries(ROLES_PLATAFORMA_BASE)) {
      if (rol === 'Super Admin') continue;
      expect(permisos).not.toContain('platform.admins.gestionar');
      expect(permisos).not.toContain('platform.roles.gestionar');
    }
  });
});
