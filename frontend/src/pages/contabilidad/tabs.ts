import type { SubNavTab } from '../../components/molecules/SubNavTabs/SubNavTabs';

/** Compartido por las 10 páginas de Contabilidad — mismo set de pestañas en todas, solo cambia cuál está activa. */
export const TABS_CONTABILIDAD: SubNavTab[] = [
  { to: '/contabilidad/cuentas', etiqueta: 'Catálogo de cuentas' },
  { to: '/contabilidad/asientos', etiqueta: 'Asientos' },
  { to: '/contabilidad/gasto-rapido', etiqueta: 'Nuevo gasto', permiso: 'contabilidad.editar' },
  { to: '/contabilidad/balance-general', etiqueta: 'Balance general' },
  { to: '/contabilidad/estado-resultados', etiqueta: 'Estado de resultados' },
  { to: '/contabilidad/balance-comprobacion', etiqueta: 'Balance de comprobación' },
  { to: '/contabilidad/libro-mayor', etiqueta: 'Libro mayor' },
  { to: '/contabilidad/conciliacion', etiqueta: 'Conciliación bancaria', permiso: 'contabilidad.conciliar' },
  { to: '/contabilidad/cierre', etiqueta: 'Cierre de período', permiso: 'contabilidad.cerrarperiodo' },
  { to: '/contabilidad/fiscal', etiqueta: 'Fiscal DGII' },
];
