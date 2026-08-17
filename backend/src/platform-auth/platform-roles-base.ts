// Catálogo de permisos y roles de PLATAFORMA (el equipo del super admin,
// no confundir con roles-base.ts que es de TENANTS). Es un catálogo
// global sembrado una sola vez por entorno (ver scripts/seed-platform-roles.ts),
// no por tenant.
export const PERMISOS_PLATAFORMA_BASE = [
  'platform.tenants.ver',
  'platform.tenants.crear',
  'platform.tenants.gestionar',
  'platform.planes.ver',
  'platform.planes.gestionar',
  'platform.admins.ver',
  'platform.admins.gestionar',
  'platform.roles.ver',
  'platform.roles.gestionar',
  'platform.auditoria.ver',
  'platform.facturacion.ver',
  'platform.facturacion.gestionar',
  'platform.pagos.registrar',
];

export const ROLES_PLATAFORMA_BASE: Record<string, string[]> = {
  'Super Admin': PERMISOS_PLATAFORMA_BASE,
  Ventas: [
    'platform.tenants.ver',
    'platform.tenants.crear',
    'platform.tenants.gestionar',
    'platform.planes.ver',
    'platform.facturacion.ver',
    'platform.facturacion.gestionar',
    'platform.pagos.registrar',
  ],
  Soporte: ['platform.tenants.ver', 'platform.planes.ver', 'platform.auditoria.ver', 'platform.facturacion.ver'],
};
