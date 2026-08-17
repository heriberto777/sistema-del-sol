// Catálogo de módulos activables por tenant (control desde plataforma,
// ver ModuloActivoGuard) y los planes por defecto que se siembran una
// sola vez para toda la plataforma (no es por tenant, a diferencia de
// PERMISOS_BASE/CUENTAS_BASE/CONFIGURACIONES_BASE en roles-base.ts).
//
// Contabilidad, Contactos (clientes/proveedores), Reportes,
// Notificaciones y Admin quedan deliberadamente FUERA de este catálogo:
// son plomería compartida entre varios módulos (ej. Bancos/Gastos
// Menores dependen del catálogo de cuentas de Contabilidad) — siempre
// están activos, sin guard ni excepción posible. Ver docs/ARCHITECTURE.md.
export const MODULOS_BASE: { clave: string; nombre: string }[] = [
  { clave: 'facturacion', nombre: 'Facturación' },
  { clave: 'cotizaciones', nombre: 'Cotizaciones' },
  { clave: 'remisiones', nombre: 'Remisiones' },
  { clave: 'inventario', nombre: 'Inventario' },
  { clave: 'compras', nombre: 'Compras' },
  { clave: 'productos', nombre: 'Productos' },
  { clave: 'pos', nombre: 'Punto de venta' },
  { clave: 'nomina', nombre: 'Nómina' },
  { clave: 'bancos', nombre: 'Bancos' },
  { clave: 'gastosmenores', nombre: 'Gastos menores' },
  { clave: 'ia', nombre: 'IA' },
  { clave: 'inmobiliaria', nombre: 'Inmobiliaria (plugin)' },
];

export const PLANES_BASE: Record<string, { descripcion: string; modulos: string[] }> = {
  Básico: {
    descripcion: 'Facturación, inventario y compras — lo esencial para empezar.',
    modulos: ['facturacion', 'cotizaciones', 'remisiones', 'inventario', 'compras', 'productos'],
  },
  Profesional: {
    descripcion: 'Básico + punto de venta y control de caja/gastos menores.',
    modulos: ['facturacion', 'cotizaciones', 'remisiones', 'inventario', 'compras', 'productos', 'pos', 'bancos', 'gastosmenores'],
  },
  Premium: {
    descripcion: 'Todo lo anterior + nómina, IA y plugins.',
    modulos: [
      'facturacion', 'cotizaciones', 'remisiones', 'inventario', 'compras', 'productos',
      'pos', 'bancos', 'gastosmenores', 'nomina', 'ia', 'inmobiliaria',
    ],
  },
};
