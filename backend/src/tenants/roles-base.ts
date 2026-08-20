// Catálogo de permisos y roles base que se siembran en CADA tenant nuevo
// (tanto el "demo" de prisma/seed.ts como los provisionados por
// TenantsService.crear). Vive en un solo lugar para que ambos no diverjan.
export const PERMISOS_BASE = [
  'facturacion.crear', 'facturacion.anular', 'facturacion.cobrar', 'facturacion.ver', 'facturacion.imprimir',
  'cotizaciones.crear', 'cotizaciones.editar', 'cotizaciones.ver',
  'remisiones.crear', 'remisiones.editar', 'remisiones.ver',
  'contabilidad.ver', 'contabilidad.editar', 'contabilidad.anular', 'contabilidad.cerrarperiodo', 'contabilidad.conciliar',
  'bancos.ver', 'bancos.editar',
  'gastosmenores.ver', 'gastosmenores.crear',
  'nomina.ver', 'nomina.editar',
  'pos.ver', 'pos.editar', 'pos.supervisar',
  'ia.usar',
  'notificaciones.ver',
  'inventario.ver', 'inventario.ajustar', 'inventario.transferir',
  'precios.ver', 'precios.editar',
  'ofertas.ver', 'ofertas.editar',
  'bonos.ver', 'bonos.editar',
  'compras.crear', 'compras.recibir', 'compras.pagar', 'compras.ver',
  'clientes.crear', 'clientes.editar', 'clientes.ver',
  'reportes.ver',
  'admin.configuracion', 'admin.usuarios',
  'auditoria.ver',
];

export const ROLES_BASE: Record<string, string[]> = {
  'Admin Total': PERMISOS_BASE,
  Gerente: PERMISOS_BASE.filter((p) => !p.startsWith('admin.')),
  // Vendedor y Cajero se separaron en dos roles (antes uno solo hacía
  // ambas cosas) — ver docs/ARCHITECTURE.md, "Roles de POS: Cajero,
  // Vendedor, Supervisor de Caja". Vendedor = ventas de oficina/campo
  // (cotizaciones, remisiones) SIN tocar caja; Cajero = solo POS.
  Vendedor: [
    'cotizaciones.crear', 'cotizaciones.editar', 'cotizaciones.ver',
    'remisiones.crear', 'remisiones.editar', 'remisiones.ver',
    'clientes.crear', 'clientes.ver', 'precios.ver',
    'ia.usar', 'notificaciones.ver',
  ],
  Cajero: [
    // facturacion.anular (acotado a la propia venta de POS mientras el
    // turno sigue abierto — ver FacturacionService.anular) y
    // facturacion.imprimir reusan los endpoints de Facturación normal, no
    // hay una ruta separada solo para POS.
    'facturacion.anular', 'facturacion.imprimir',
    'clientes.crear', 'clientes.ver', 'precios.ver', 'bonos.ver',
    'pos.ver', 'pos.editar', 'ia.usar', 'notificaciones.ver',
  ],
  // Mismo alcance que Cajero + pos.supervisar: puede cerrar el turno de
  // OTRO cajero y anular cualquier venta de POS sin la restricción de
  // "propio turno abierto" — sin darle nómina/contabilidad/admin, que sí
  // traería venir de Gerente/Admin Total.
  'Supervisor de Caja': [
    'facturacion.anular', 'facturacion.imprimir',
    'clientes.crear', 'clientes.ver', 'precios.ver', 'bonos.ver',
    'pos.ver', 'pos.editar', 'pos.supervisar', 'ia.usar', 'notificaciones.ver',
  ],
  Almacenero: ['inventario.ver', 'inventario.ajustar', 'inventario.transferir', 'compras.recibir', 'remisiones.ver'],
  Contador: ['facturacion.ver', 'facturacion.cobrar', 'facturacion.imprimir', 'compras.ver', 'compras.pagar', 'reportes.ver', 'precios.ver', 'contabilidad.ver', 'contabilidad.editar', 'contabilidad.anular', 'contabilidad.cerrarperiodo', 'contabilidad.conciliar', 'bancos.ver', 'bancos.editar', 'gastosmenores.ver', 'gastosmenores.crear', 'nomina.ver', 'nomina.editar', 'ia.usar', 'notificaciones.ver'],
  Auditor: ['auditoria.ver', 'facturacion.ver', 'facturacion.imprimir', 'inventario.ver', 'compras.ver', 'reportes.ver', 'cotizaciones.ver', 'remisiones.ver', 'contabilidad.ver', 'bancos.ver', 'gastosmenores.ver', 'nomina.ver', 'notificaciones.ver'],
};

export const CONFIGURACIONES_BASE: Record<string, string> = {
  ITBIS_GENERAL: '18',
  ITBIS_REDUCIDA: '8',
  PLAZO_PAGO_DIAS: '30',
  STOCK_MINIMO_DEFAULT: '10',
  // Referencia para quien registra un pago a proveedor con retención (ver
  // PagosService.registrarPagoOrdenCompra) — el disparador es manual, así
  // que el backend nunca calcula el %, solo documenta el valor vigente.
  // Tasa de ISR: hay referencias (no verificadas contra fuente oficial en
  // tiempo real) de que subió de 10% a 15% para pagos del Art. 309 desde
  // julio 2026 — confirmar antes de producción, igual que las tasas de
  // TSS/ISR de Nómina.
  RETENCION_ISR_TASA: '15',
  RETENCION_ITBIS_TASA: '30',
  // A diferencia de las anteriores, esta SÍ se lee programáticamente (ver
  // PosService.cerrarTurno): si |diferencia| del arqueo supera este monto
  // (RD$), exige justificacionDiferencia para poder cerrar el turno.
  POS_TOLERANCIA_ARQUEO: '50',
  // Formato de impresión por defecto para Facturación/Cotizaciones/
  // Remisiones/POS (ver resolver-formato-impresion.ts) — un valor del
  // enum FormatoImpresion. Una Bodega puede anularlo puntualmente.
  FORMATO_IMPRESION_DEFAULT: 'CARTA',
};
