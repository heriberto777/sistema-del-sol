// Catálogo de permisos y roles base que se siembran en CADA tenant nuevo
// (tanto el "demo" de prisma/seed.ts como los provisionados por
// TenantsService.crear). Vive en un solo lugar para que ambos no diverjan.
export const PERMISOS_BASE = [
  'facturacion.crear', 'facturacion.anular', 'facturacion.cobrar', 'facturacion.ver',
  'cotizaciones.crear', 'cotizaciones.editar', 'cotizaciones.ver',
  'remisiones.crear', 'remisiones.editar', 'remisiones.ver',
  'contabilidad.ver', 'contabilidad.editar',
  'nomina.ver', 'nomina.editar',
  'pos.ver', 'pos.editar',
  'ia.usar',
  'notificaciones.ver',
  'inventario.ver', 'inventario.ajustar', 'inventario.transferir',
  'precios.ver', 'precios.editar',
  'compras.crear', 'compras.recibir', 'compras.pagar', 'compras.ver',
  'clientes.crear', 'clientes.editar', 'clientes.ver',
  'reportes.ver',
  'admin.configuracion', 'admin.usuarios', 'admin.plugins',
  'auditoria.ver',
];

export const ROLES_BASE: Record<string, string[]> = {
  'Admin Total': PERMISOS_BASE,
  Gerente: PERMISOS_BASE.filter((p) => !p.startsWith('admin.')),
  Vendedor: [
    'facturacion.crear', 'facturacion.ver', 'facturacion.cobrar',
    'cotizaciones.crear', 'cotizaciones.editar', 'cotizaciones.ver',
    'remisiones.crear', 'remisiones.editar', 'remisiones.ver',
    'clientes.crear', 'clientes.ver', 'precios.ver',
    'pos.ver', 'pos.editar', 'ia.usar', 'notificaciones.ver',
  ],
  Almacenero: ['inventario.ver', 'inventario.ajustar', 'inventario.transferir', 'compras.recibir', 'remisiones.ver'],
  Contador: ['facturacion.ver', 'facturacion.cobrar', 'compras.ver', 'compras.pagar', 'reportes.ver', 'precios.ver', 'contabilidad.ver', 'contabilidad.editar', 'nomina.ver', 'nomina.editar', 'ia.usar', 'notificaciones.ver'],
  Auditor: ['auditoria.ver', 'facturacion.ver', 'inventario.ver', 'compras.ver', 'reportes.ver', 'cotizaciones.ver', 'remisiones.ver', 'contabilidad.ver', 'nomina.ver', 'notificaciones.ver'],
};

export const CONFIGURACIONES_BASE: Record<string, string> = {
  ITBIS_GENERAL: '18',
  ITBIS_REDUCIDA: '8',
  PLAZO_PAGO_DIAS: '30',
  STOCK_MINIMO_DEFAULT: '10',
};
