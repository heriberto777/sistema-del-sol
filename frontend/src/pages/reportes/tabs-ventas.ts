import type { SubNavTab } from '../../components/molecules/SubNavTabs/SubNavTabs';

export const TABS_REPORTES_VENTAS: SubNavTab[] = [
  { to: '/reportes/ventas', etiqueta: 'Ventas' },
  { to: '/reportes/ventas-agrupadas', etiqueta: 'Ventas agrupadas' },
  { to: '/reportes/rentabilidad', etiqueta: 'Rentabilidad' },
  // Permiso propio (comisiones.ver, no reportes.ver) — antes la pestaña se
  // veía igual para todos en el hub mixto y el bloqueo era solo de
  // contenido (hallazgo de la auditoría); ahora SubNavTabs la oculta
  // directamente si falta el permiso.
  //
  // Comisión de VENDEDOR (ComisionVenta, automática por línea de factura,
  // solo reporte) — distinta de la comisión de AGENTE inmobiliario
  // (Inmobiliaria > Contratos y comisiones, manual por contrato, con su
  // propio flujo de pago). Comparten nombre, no tabla ni lógica —
  // auditoría de organización, decisión explícita de no fusionarlas.
  { to: '/reportes/comisiones', etiqueta: 'Comisiones', permiso: 'comisiones.ver' },
];
