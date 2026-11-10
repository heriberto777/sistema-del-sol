import { BookOpen, Boxes, FolderKanban, Globe, HandCoins, Home, LayoutGrid, type LucideIcon, Megaphone, Plane, Receipt, ShieldCheck, ShoppingBag, Target, Users } from 'lucide-react';

export type CategoriaErp = 'catalogos' | 'transacciones' | 'consultas' | 'reportes' | 'configuracion';

export const ETIQUETA_CATEGORIA_ERP: Record<CategoriaErp, string> = {
  catalogos: 'Catálogos',
  transacciones: 'Transacciones',
  consultas: 'Consultas',
  reportes: 'Reportes',
  configuracion: 'Configuración',
};

export interface ItemMenu {
  id: string;
  etiqueta: string;
  ruta: string;
  /** OR — alcanza con tener uno de estos permisos. Mismo criterio que `esVisible()` del Sidebar anterior. */
  permisos?: string[];
  /** Clave de `MODULOS_BASE` — si está presente, además exige que el tenant lo tenga activo (plan + excepciones). */
  modulo?: string;
}

export interface CategoriaMenu {
  categoria: CategoriaErp;
  items: ItemMenu[];
}

export interface DominioMenu {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  categorias: CategoriaMenu[];
}

/**
 * Esquema modular tipo ERP (Softland): cada dominio de negocio desglosado en
 * Catálogos/Transacciones/Consultas/Reportes/Configuración. Reemplaza al
 * Sidebar de 2 niveles (Grupo → Ítem) — ver docs/ARCHITECTURE.md.
 *
 * Dos adaptaciones deliberadas frente al molde ERP clásico, documentadas acá
 * porque no son evidentes mirando solo los datos:
 * - "Reportes" en este sistema es un hub transversal único (`/reportes`,
 *   filtrable por módulo) — nunca una pantalla propia por dominio. Cada
 *   columna "Reportes" de abajo apunta ahí.
 * - "Consultas" no es una pantalla aparte de "Transacciones" — el listado de
 *   cada entidad ya es buscador+filtro+tabla en una sola pantalla. La
 *   columna "Consultas" referencia esa misma ruta en su rol de búsqueda.
 */
export const DOMINIOS_MENU: DominioMenu[] = [
  {
    id: 'ventas',
    etiqueta: 'Ventas',
    icono: Receipt,
    categorias: [
      {
        // Solo lo que describe CÓMO se vende y a quién — qué ES un producto
        // (Productos/Categorías/Niveles de precio/Atributos) vive en
        // Inventario, es el mismo maestro de artículos sin importar el canal
        // de venta. Auditoría de organización del menú (pedido explícito del
        // usuario, comparando contra cómo generan/mantienen cada dato).
        categoria: 'catalogos',
        items: [
          { id: 'ofertas', etiqueta: 'Ofertas', ruta: '/ofertas', permisos: ['ofertas.ver'] },
          { id: 'bonos', etiqueta: 'Bonos', ruta: '/bonos', permisos: ['bonos.ver'] },
          { id: 'cajas', etiqueta: 'Cajas', ruta: '/cajas', permisos: ['pos.ver'] },
          { id: 'clientes', etiqueta: 'Clientes', ruta: '/clientes', permisos: ['clientes.ver', 'compras.ver'] },
          // Antes vivía en Seguridad y Administración — no tiene nada que
          // ver con seguridad, es dato de Ventas/CRM igual que Clientes.
          { id: 'categorias-cliente', etiqueta: 'Categorías de cliente', ruta: '/categorias-cliente', permisos: ['clientes.ver'] },
        ],
      },
      {
        categoria: 'transacciones',
        items: [
          { id: 'factura-nueva', etiqueta: 'Nueva factura', ruta: '/facturacion/nueva', permisos: ['facturacion.crear'], modulo: 'facturacion' },
          { id: 'cotizacion-nueva', etiqueta: 'Nueva cotización', ruta: '/cotizaciones/nueva', permisos: ['cotizaciones.crear'], modulo: 'cotizaciones' },
          { id: 'remision-nueva', etiqueta: 'Nueva remisión', ruta: '/remisiones/nueva', permisos: ['remisiones.crear'], modulo: 'remisiones' },
          { id: 'nota-credito', etiqueta: 'Nota de crédito/débito', ruta: '/notas-credito', permisos: ['facturacion.ver'], modulo: 'facturacion' },
          { id: 'pos-vender', etiqueta: 'Vender (Punto de venta)', ruta: '/pos', permisos: ['pos.ver'], modulo: 'pos' },
        ],
      },
      {
        categoria: 'consultas',
        items: [
          { id: 'facturas', etiqueta: 'Buscar facturas', ruta: '/facturacion', permisos: ['facturacion.ver'], modulo: 'facturacion' },
          { id: 'cotizaciones', etiqueta: 'Buscar cotizaciones', ruta: '/cotizaciones', permisos: ['cotizaciones.ver'], modulo: 'cotizaciones' },
          { id: 'remisiones', etiqueta: 'Buscar remisiones', ruta: '/remisiones', permisos: ['remisiones.ver'], modulo: 'remisiones' },
          // Cuentas por cobrar vive en su propio dominio ("Cuentas por Cobrar
          // y Pagar", estilo ERP) — para no mezclar el subledger financiero
          // con las transacciones de venta (pedido explícito del usuario).
        ],
      },
      {
        // Antes todas estas pestañas vivían mezcladas en un solo hub
        // transversal (/reportes) junto con Compras/Inventario/Finanzas/
        // Nómina — se disolvió, cada reporte vive ahora en su dominio real
        // (auditoría de organización, "100% ERP", ver docs/ARCHITECTURE.md).
        categoria: 'reportes',
        items: [{ id: 'reportes-ventas', etiqueta: 'Ventas y comisiones', ruta: '/reportes/ventas', permisos: ['reportes.ver'] }],
      },
      // Benchmark 2026-11-09 (Cuadre.do/Alegra, pedido explícito del
      // usuario): toda la categoría "Configuración" de los dominios se
      // consolidó en un hub central (/configuracion, ver
      // config/configuracion-hub.ts) — Formato de Documentos/Documentos/
      // Lealtad se gestionan ahí ahora, no en este menú.
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'compras',
    etiqueta: 'Compras',
    icono: ShoppingBag,
    categorias: [
      {
        // Simetría con Clientes (Ventas > Catálogos) — mismo tipo de dato
        // maestro, misma categoría. Antes vivía en Consultas sin razón
        // visible (auditoría de organización, "100% ERP").
        categoria: 'catalogos',
        items: [
          { id: 'proveedores', etiqueta: 'Proveedores', ruta: '/proveedores', permisos: ['compras.ver'] },
          // Paridad con Categorías de cliente (Ventas > Catálogos) — auditoría
          // de organización, "100% ERP".
          { id: 'categorias-proveedor', etiqueta: 'Categorías de proveedor', ruta: '/categorias-proveedor', permisos: ['compras.ver'] },
        ],
      },
      // Auditoría UX Fase 3 — ahora es página propia (antes abría el modal
      // de /compras), mismo criterio que "Nueva factura" en Ventas.
      { categoria: 'transacciones', items: [{ id: 'compra-nueva', etiqueta: 'Nueva orden de compra', ruta: '/compras/nueva', permisos: ['compras.crear'], modulo: 'compras' }] },
      {
        categoria: 'consultas',
        items: [
          { id: 'compras', etiqueta: 'Buscar órdenes de compra', ruta: '/compras', permisos: ['compras.ver'], modulo: 'compras' },
          // Cuentas por pagar/Facturas de proveedor viven en su propio
          // dominio ("Cuentas por Cobrar y Pagar", estilo ERP) — ver ahí.
        ],
      },
      { categoria: 'reportes', items: [{ id: 'reportes-compras', etiqueta: 'Compras', ruta: '/reportes/compras', permisos: ['reportes.ver'] }] },
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    // Dominio propio (estilo ERP clásico: subledger de AR/AP separado de las
    // transacciones de Ventas/Compras que las originan) — pedido explícito
    // del usuario al agregar Facturas de proveedor (Fase 5), para no seguir
    // mezclando el ledger financiero dentro de Ventas/Compras.
    id: 'cxc-cxp',
    etiqueta: 'Cuentas por Cobrar y Pagar',
    icono: HandCoins,
    categorias: [
      {
        categoria: 'catalogos',
        items: [{ id: 'terminos-pago', etiqueta: 'Términos de pago', ruta: '/terminos-pago', permisos: ['cuentasporcobrar.terminospago.ver'] }],
      },
      { categoria: 'transacciones', items: [] },
      {
        categoria: 'consultas',
        items: [
          { id: 'cxc', etiqueta: 'Cuentas por cobrar', ruta: '/cuentas-por-cobrar', permisos: ['cuentasporcobrar.ver'], modulo: 'facturacion' },
          { id: 'cxp', etiqueta: 'Cuentas por pagar', ruta: '/cuentas-por-pagar', permisos: ['cuentasporpagar.ver'], modulo: 'compras' },
          // Gasto a crédito sin orden de compra (luz, alquiler, servicios) — mismo "ambiente" de CxP.
          { id: 'facturas-proveedor', etiqueta: 'Facturas de proveedor', ruta: '/facturas-proveedor', permisos: ['facturasproveedor.ver'], modulo: 'compras' },
        ],
      },
      {
        categoria: 'reportes',
        items: [
          { id: 'reportes-retenciones-proveedores', etiqueta: 'Retenciones a proveedores', ruta: '/reportes/retenciones-proveedores', permisos: ['reportes.ver'] },
        ],
      },
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'inventario',
    etiqueta: 'Inventario',
    icono: Boxes,
    categorias: [
      {
        // Maestro de artículos — qué ES un producto y su estructura, sin
        // importar si se vende por Facturación, POS o la Tienda Online.
        // Antes vivían en Ventas; se mudaron acá (auditoría de
        // organización del menú, pedido explícito del usuario).
        categoria: 'catalogos',
        items: [
          { id: 'productos', etiqueta: 'Productos', ruta: '/productos', permisos: ['precios.ver'], modulo: 'productos' },
          { id: 'categorias', etiqueta: 'Categorías', ruta: '/categorias', permisos: ['precios.ver'] },
          { id: 'niveles-precio', etiqueta: 'Niveles de precio', ruta: '/niveles-precio', permisos: ['precios.ver'] },
          { id: 'atributos', etiqueta: 'Atributos', ruta: '/atributos', permisos: ['precios.ver'] },
          // Antes en Configuración con permiso admin.configuracion — mismo
          // patrón de catálogo que Categorías/Niveles de precio/Atributos,
          // sin razón para el trato distinto (auditoría de organización).
          { id: 'unidades-medida', etiqueta: 'Unidades de medida', ruta: '/inventario/configuracion', permisos: ['precios.ver'] },
          // Huérfana hasta ahora (sin ninguna entrada de menú) — catálogo de
          // clasificación fiscal de productos, usado solo por el formulario
          // de Producto (SelectLeyFiscal), mismo permiso que sus hermanos.
          { id: 'leyes-fiscales', etiqueta: 'Leyes fiscales', ruta: '/leyes-fiscales', permisos: ['precios.ver'] },
          { id: 'bodegas', etiqueta: 'Bodegas (Sucursales)', ruta: '/sucursales', permisos: ['sucursales.ver'] },
        ],
      },
      {
        categoria: 'transacciones',
        items: [
          // Auditoría UX Fase 2 — antes ambos apuntaban a '/inventario' (el
          // mismo bug de "siempre abre la pestaña por defecto" que ya se
          // arregló en otros hubs). Ahora cada uno va directo a su propia
          // página de creación multi-línea, mismo criterio que "Nueva
          // factura"/"Nueva orden de compra".
          { id: 'ajuste', etiqueta: 'Ajuste de inventario', ruta: '/inventario/ajustes/nuevo', permisos: ['inventario.ajustar'], modulo: 'inventario' },
          { id: 'transferencia', etiqueta: 'Transferencia entre bodegas', ruta: '/inventario/transferencias/nuevo', permisos: ['inventario.transferir'], modulo: 'inventario' },
          { id: 'conteo', etiqueta: 'Conteo físico', ruta: '/inventario/conteos', permisos: ['inventario.contar'], modulo: 'inventario' },
          // Antes en Configuración — es una acción (generar e imprimir en
          // lote), no un ajuste de una vez.
          { id: 'etiquetas', etiqueta: 'Etiquetas de código de barras', ruta: '/productos/etiquetas', permisos: ['precios.ver'], modulo: 'productos' },
        ],
      },
      {
        categoria: 'consultas',
        items: [
          { id: 'stock', etiqueta: 'Stock actual', ruta: '/inventario/stock', permisos: ['inventario.ver'], modulo: 'inventario' },
          { id: 'alertas', etiqueta: 'Alertas de inventario', ruta: '/inventario/alertas', permisos: ['inventario.ver'], modulo: 'inventario' },
          // Antes solo se llegaba acá por la barra de tabs redundante del
          // hub viejo — "Ajuste de inventario"/"Transferencia entre
          // bodegas" en Transacciones solo llevan a /nuevo, nunca al
          // listado (auditoría de navegación duplicada).
          { id: 'historial-ajustes', etiqueta: 'Historial de ajustes', ruta: '/inventario/ajustes', permisos: ['inventario.ver'], modulo: 'inventario' },
          {
            id: 'historial-transferencias',
            etiqueta: 'Historial de transferencias',
            ruta: '/inventario/transferencias',
            permisos: ['inventario.ver'],
            modulo: 'inventario',
          },
        ],
      },
      { categoria: 'reportes', items: [{ id: 'reportes-inventario', etiqueta: 'Inventario y rotación', ruta: '/reportes/inventario', permisos: ['reportes.ver'] }] },
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'finanzas',
    etiqueta: 'Finanzas y Contabilidad',
    icono: BookOpen,
    categorias: [
      {
        categoria: 'catalogos',
        items: [
          { id: 'cuentas-bancarias', etiqueta: 'Cuentas bancarias', ruta: '/bancos', permisos: ['bancos.ver'], modulo: 'bancos' },
          // Antes en Configuración — el propio backend lo llama "catálogo
          // manual de tasas de cambio" en su propio comentario de código.
          // Permiso-OR con travel.ver: Travel también consume TasaCambio
          // (reservas en moneda extranjera) — antes gateaba solo con un
          // permiso de Facturación (auditoría de organización).
          { id: 'tasas-cambio', etiqueta: 'Tasas de cambio', ruta: '/tasas-cambio', permisos: ['facturacion.crear', 'travel.ver'] },
          { id: 'catalogo-cuentas', etiqueta: 'Catálogo de cuentas', ruta: '/contabilidad/cuentas', permisos: ['contabilidad.ver'] },
          // Antes en Ventas > Catálogos — infraestructura financiera
          // transversal (la usan también Compras, Facturas de proveedor,
          // Lealtad, Bonos y POS), no exclusiva de Ventas.
          { id: 'formas-pago', etiqueta: 'Formas de pago', ruta: '/formas-pago', permisos: ['admin.configuracion'] },
        ],
      },
      {
        categoria: 'transacciones',
        items: [
          // Auditoría UX Fase 4 — página propia (antes modal), mismo criterio
          // que "Nueva orden de compra"/"Ajuste de inventario".
          { id: 'asiento', etiqueta: 'Asiento contable', ruta: '/contabilidad/asientos/nuevo', permisos: ['contabilidad.editar'] },
          // Antes en /bancos (bug real de ruteo — el menú prometía
          // conciliación y abría el CRUD de cuentas bancarias, porque esa
          // ruta nunca coincidía con ninguna pestaña; ver docs/ARCHITECTURE.md).
          { id: 'conciliacion', etiqueta: 'Conciliación bancaria', ruta: '/contabilidad/conciliacion', permisos: ['contabilidad.conciliar'] },
          { id: 'gasto-rapido', etiqueta: 'Gasto rápido (2 líneas)', ruta: '/contabilidad/gasto-rapido', permisos: ['contabilidad.editar'] },
          { id: 'gasto-menor', etiqueta: 'Registrar gasto menor', ruta: '/gastos-menores', permisos: ['gastosmenores.crear', 'gastosmenores.ver'], modulo: 'gastosmenores' },
          { id: 'cierre-periodo', etiqueta: 'Cierre de período', ruta: '/contabilidad/cierre', permisos: ['contabilidad.cerrarperiodo'] },
        ],
      },
      {
        categoria: 'consultas',
        items: [
          { id: 'libro-mayor', etiqueta: 'Libro diario / mayor', ruta: '/contabilidad/libro-mayor', permisos: ['contabilidad.ver'] },
          // Antes solo se llegaba acá por la barra de tabs redundante del
          // hub viejo — "Asiento contable" en Transacciones solo lleva a
          // /nuevo, nunca al listado (auditoría de navegación duplicada).
          { id: 'historial-asientos', etiqueta: 'Historial de asientos', ruta: '/contabilidad/asientos', permisos: ['contabilidad.ver'] },
        ],
      },
      {
        // Antes un solo ítem apuntando al hub mixto /reportes — Balance
        // general/Estado de resultados/Balance de comprobación no tenían
        // NINGUNA entrada de menú (hallazgo de la auditoría, Contabilidad.tsx
        // ya tenía esas 3 pestañas desde antes).
        categoria: 'reportes',
        items: [
          { id: 'reportes-fiscal-dgii', etiqueta: 'Fiscal DGII', ruta: '/contabilidad/fiscal', permisos: ['reportes.ver'] },
          { id: 'balance-general', etiqueta: 'Balance general', ruta: '/contabilidad/balance-general', permisos: ['contabilidad.ver'] },
          { id: 'estado-resultados', etiqueta: 'Estado de resultados', ruta: '/contabilidad/estado-resultados', permisos: ['contabilidad.ver'] },
          { id: 'balance-comprobacion', etiqueta: 'Balance de comprobación', ruta: '/contabilidad/balance-comprobacion', permisos: ['contabilidad.ver'] },
        ],
      },
      // Benchmark 2026-11-09 — NCF/Consecutivos/Autorizaciones/Pasarela de
      // pago se gestionan ahora desde el hub central (/configuracion).
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'nomina',
    etiqueta: 'Nómina y RRHH',
    icono: Users,
    categorias: [
      {
        // "Empleados" vive en /nomina (tab propio de Nomina.tsx), NO en
        // /rrhh como tenía antes esta entrada — error real de ruta
        // encontrado al auditar el código (RRHH.tsx no tiene ningún tab de
        // empleados). Las otras 6 son RRHH.tsx disuelto en páginas propias,
        // mismo criterio que Admin.tsx.
        categoria: 'catalogos',
        items: [
          { id: 'empleados', etiqueta: 'Empleados', ruta: '/nomina/empleados', permisos: ['nomina.ver'], modulo: 'nomina' },
          { id: 'puestos', etiqueta: 'Puestos', ruta: '/puestos', permisos: ['nomina.ver'], modulo: 'nomina' },
          { id: 'plantillas-horario', etiqueta: 'Plantillas de horario', ruta: '/plantillas-horario', permisos: ['rrhh.ver'], modulo: 'nomina' },
          { id: 'feriados', etiqueta: 'Feriados', ruta: '/feriados', permisos: ['rrhh.ver'], modulo: 'nomina' },
        ],
      },
      {
        categoria: 'transacciones',
        items: [
          { id: 'procesar-nomina', etiqueta: 'Procesar nómina', ruta: '/nomina/periodos', permisos: ['nomina.editar'], modulo: 'nomina' },
          { id: 'horarios-empleado', etiqueta: 'Asignar horarios', ruta: '/horarios-empleado', permisos: ['rrhh.ver'], modulo: 'nomina' },
          { id: 'asistencia', etiqueta: 'Marcar asistencia', ruta: '/asistencia', permisos: ['rrhh.ver'], modulo: 'nomina' },
          { id: 'ausencias', etiqueta: 'Registrar ausencia', ruta: '/ausencias', permisos: ['rrhh.ver'], modulo: 'nomina' },
        ],
      },
      { categoria: 'consultas', items: [{ id: 'historial-nomina', etiqueta: 'Historial de nómina', ruta: '/nomina/periodos', permisos: ['nomina.ver'], modulo: 'nomina' }] },
      {
        // Antes apuntaba al hub mixto /reportes — "Retenciones de ISR" es lo
        // único que ya existía como reporte real de este dominio (extraído
        // de la pestaña DGII, ver docs/ARCHITECTURE.md). No hay endpoint de
        // "costo laboral por período" todavía — queda fuera de esta reorganización.
        categoria: 'reportes',
        items: [{ id: 'reportes-nomina', etiqueta: 'Retenciones de ISR', ruta: '/nomina/retenciones', permisos: ['reportes.ver'] }],
      },
      // Benchmark 2026-11-09 — Tipos de ausencia se gestiona ahora desde el
      // hub central (/configuracion).
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'seguridad',
    etiqueta: 'Seguridad y Administración',
    icono: ShieldCheck,
    categorias: [
      { categoria: 'catalogos', items: [] },
      { categoria: 'transacciones', items: [] },
      {
        // Auditoría ya se graba sola desde hace tiempo (AuditLogInterceptor
        // global) — esto solo la expone. Separado de "configuracion" porque
        // es consulta de histórico, no un parámetro que se edita.
        categoria: 'consultas',
        // Auditoría UX Fase 6 — antes '/auditoria' siempre abría la pestaña
        // "Actividad" aunque hoy ya coincide con el default, ahora es explícito.
        items: [{ id: 'auditoria', etiqueta: 'Auditoría y logs', ruta: '/auditoria/actividad', permisos: ['auditoria.ver'] }],
      },
      { categoria: 'reportes', items: [] },
      {
        // Benchmark 2026-11-09 (Cuadre.do/Alegra, pedido explícito del
        // usuario): los 8 ítems que vivían acá sueltos (Usuarios, Roles,
        // Datos de empresa, Parámetros, Webhooks, WhatsApp, Correo,
        // Plantillas) MÁS los de "configuracion" de todos los demás
        // dominios (Ventas, Finanzas, Nómina, CRM, Travel, Tienda Online)
        // se consolidaron en un solo hub de tarjetas por categoría
        // (`/configuracion`, ver config/configuracion-hub.ts) — mismo
        // patrón que la pantalla de Configuración de Alegra. Esto deshace a
        // propósito el criterio "cada acción en su dominio real" SOLO para
        // esta categoría puntual (el resto del menú sigue igual).
        categoria: 'configuracion',
        items: [
          {
            id: 'configuracion-general',
            etiqueta: 'Configuración',
            ruta: '/configuracion',
            permisos: ['admin.usuarios', 'admin.configuracion', 'lealtad.ver', 'rrhh.ver', 'crm.pipeline.configurar', 'crm.metas.configurar'],
          },
        ],
      },
    ],
  },
  {
    id: 'proyectos',
    etiqueta: 'Proyectos',
    icono: FolderKanban,
    categorias: [
      { categoria: 'catalogos', items: [] },
      { categoria: 'transacciones', items: [{ id: 'proyecto-nuevo', etiqueta: 'Crear / gestionar proyecto', ruta: '/proyectos', permisos: ['proyectos.crear'], modulo: 'proyectos' }] },
      { categoria: 'consultas', items: [{ id: 'proyectos', etiqueta: 'Buscar proyectos', ruta: '/proyectos', permisos: ['proyectos.ver'], modulo: 'proyectos' }] },
      { categoria: 'reportes', items: [{ id: 'rentabilidad', etiqueta: 'Rentabilidad', ruta: '/proyectos', permisos: ['proyectos.rentabilidad.ver'], modulo: 'proyectos' }] },
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'crm',
    etiqueta: 'CRM',
    icono: Target,
    categorias: [
      { categoria: 'catalogos', items: [{ id: 'crm-leads', etiqueta: 'Leads', ruta: '/crm/leads', permisos: ['crm.ver'], modulo: 'crm' }] },
      { categoria: 'transacciones', items: [{ id: 'crm-oportunidad-nueva', etiqueta: 'Nueva oportunidad', ruta: '/crm/pipeline', permisos: ['crm.oportunidades.crear'], modulo: 'crm' }] },
      { categoria: 'consultas', items: [{ id: 'crm-pipeline', etiqueta: 'Pipeline', ruta: '/crm/pipeline', permisos: ['crm.ver'], modulo: 'crm' }] },
      {
        // Fase 3 — embudo de conversión/forecast/ranking de vendedores.
        categoria: 'reportes',
        items: [{ id: 'crm-dashboard', etiqueta: 'Dashboard CRM', ruta: '/crm/dashboard', permisos: ['crm.reportes.ver'], modulo: 'crm' }],
      },
      // Benchmark 2026-11-09 — Etapas del pipeline y Metas de venta se
      // gestionan ahora desde el hub central (/configuracion).
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'inmobiliaria',
    etiqueta: 'Inmobiliaria',
    icono: Home,
    categorias: [
      { categoria: 'catalogos', items: [{ id: 'propiedades', etiqueta: 'Propiedades', ruta: '/propiedades', permisos: ['inmobiliaria.propiedades.ver'], modulo: 'inmobiliaria' }] },
      {
        categoria: 'transacciones',
        items: [
          // Etiqueta alineada al propio h1 de la página ("Contratos y
          // comisiones") — la comisión de agente inmobiliario
          // (ContratoPropiedad.porcentajeComision/agenteId, con su propio
          // flujo de "marcar pagada") es un sistema completo y DISTINTO de
          // ComisionVenta (Ventas > Reportes > Comisiones, automática por
          // línea de factura) — comparten nombre, no tabla ni lógica.
          // Auditoría de organización ("100% ERP"): se decidió no
          // fusionarlos (ciclos de vida genuinamente distintos), solo
          // dejar claro en el menú que son cosas separadas.
          { id: 'contrato-nuevo', etiqueta: 'Contratos y comisiones', ruta: '/contratos-propiedad', permisos: ['inmobiliaria.contratos.ver'], modulo: 'inmobiliaria' },
          { id: 'alquileres', etiqueta: 'Cobrar alquileres', ruta: '/alquileres', permisos: ['inmobiliaria.alquileres.ver'], modulo: 'inmobiliaria' },
        ],
      },
      { categoria: 'consultas', items: [] },
      // Auditoría UX Fase 8 — antes sin reporte propio.
      {
        categoria: 'reportes',
        items: [{ id: 'inmobiliaria-resumen', etiqueta: 'Resumen de Inmobiliaria', ruta: '/reportes/inmobiliaria', permisos: ['reportes.ver'] }],
      },
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'travel',
    etiqueta: 'Viajes',
    icono: Plane,
    categorias: [
      // Auditoría UX Fase 5 — antes las 5 pestañas de Travel vivían en un
      // solo archivo sin URL propia (mismo bug que Inventario/Contabilidad/
      // Nómina/Reportes/Tienda Online, ver docs/ARCHITECTURE.md): "Buscar y
      // reservar vuelo" apuntaba a /travel/reservas y siempre abría la
      // pestaña de Reservas, nunca la de búsqueda. Ahora cada pestaña es su
      // propia ruta.
      {
        categoria: 'catalogos',
        items: [{ id: 'travel-markup', etiqueta: 'Reglas de markup', ruta: '/travel/markup', permisos: ['travel.ver'] }],
      },
      {
        categoria: 'transacciones',
        items: [
          { id: 'reservar-vuelo', etiqueta: 'Buscar y reservar vuelo', ruta: '/travel/buscar-vuelo', permisos: ['travel.reservar'], modulo: 'travel' },
          { id: 'reservar-hotel', etiqueta: 'Buscar y reservar hotel', ruta: '/travel/buscar-hotel', permisos: ['travel.reservar'], modulo: 'travel' },
        ],
      },
      { categoria: 'consultas', items: [{ id: 'reservas', etiqueta: 'Mis reservas', ruta: '/travel/reservas', permisos: ['travel.ver'], modulo: 'travel' }] },
      { categoria: 'reportes', items: [{ id: 'travel-resumen', etiqueta: 'Resumen de Travel', ruta: '/travel/resumen', permisos: ['travel.ver'] }] },
      // Benchmark 2026-11-09 — Cuenta Duffel/Hotelbeds se gestiona ahora
      // desde el hub central (/configuracion).
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'publicaciones',
    etiqueta: 'Publicaciones Sociales',
    icono: Megaphone,
    categorias: [
      { categoria: 'catalogos', items: [] },
      { categoria: 'transacciones', items: [{ id: 'publicacion-nueva', etiqueta: 'Crear publicación', ruta: '/publicaciones-sociales', permisos: ['publicacionessociales.crear'], modulo: 'publicacionessociales' }] },
      { categoria: 'consultas', items: [{ id: 'publicaciones', etiqueta: 'Buscar publicaciones', ruta: '/publicaciones-sociales', permisos: ['publicacionessociales.ver'], modulo: 'publicacionessociales' }] },
      // Auditoría UX Fase 8 — antes sin reporte propio.
      {
        categoria: 'reportes',
        items: [{ id: 'publicaciones-resumen', etiqueta: 'Resumen de Publicaciones', ruta: '/reportes/publicaciones-sociales', permisos: ['reportes.ver'] }],
      },
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'tienda',
    etiqueta: 'Tienda Online',
    icono: Globe,
    categorias: [
      {
        // Permiso propio ecommerce.ver (auditoría de organización, "100%
        // ERP") — antes compartía admin.configuracion sin ninguna
        // granularidad, a diferencia de CRM/Travel/Inmobiliaria/
        // Publicaciones Sociales.
        categoria: 'catalogos',
        items: [{ id: 'secciones-home', etiqueta: 'Secciones del Home', ruta: '/tienda-online/secciones', permisos: ['ecommerce.ver'], modulo: 'ecommerce' }],
      },
      { categoria: 'transacciones', items: [{ id: 'pedidos', etiqueta: 'Gestionar pedidos', ruta: '/tienda-online/pedidos', permisos: ['ecommerce.ver'], modulo: 'ecommerce' }] },
      { categoria: 'consultas', items: [] },
      // Auditoría UX Fase 8 — antes sin reporte propio (el único dato
      // agregado que existía, resumenPendientes, era un solo número para
      // la card del Dashboard).
      {
        categoria: 'reportes',
        items: [{ id: 'tienda-resumen', etiqueta: 'Resumen de Tienda Online', ruta: '/reportes/tienda-online', permisos: ['reportes.ver'] }],
      },
      // Benchmark 2026-11-09 — Dominio propio y branding se gestiona ahora
      // desde el hub central (/configuracion).
      { categoria: 'configuracion', items: [] },
    ],
  },
];

/**
 * Dashboard y Reportes quedan sueltos — son los dos "índices" transversales
 * del sistema, ninguno pertenece a un solo dominio de negocio (segunda
 * auditoría de menú, pedido explícito del usuario: "muchos ítems sueltos
 * arriba"). Reportes (benchmark 2026-11-09, Fase 3 — mismo criterio que
 * Alegra/Cuadre) es el catálogo central de TODOS los reportes del sistema,
 * agrupados por categoría — ver config/reportes-hub.ts. No reemplaza los
 * ítems de "reportes" que cada dominio ya tiene en su propio menú (esos
 * siguen ahí, "100% ERP"); es solo un índice adicional para encontrarlos
 * todos juntos, igual que /configuracion no reemplazó ninguna ruta real.
 */
export const UTILIDADES_GENERALES: ItemMenu[] = [
  { id: 'dashboard', etiqueta: 'Dashboard', ruta: '/', permisos: ['reportes.ver'] },
  { id: 'reportes-catalogo', etiqueta: 'Reportes', ruta: '/reportes', permisos: ['reportes.ver'] },
];

export interface GrupoUtilidades {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  items: ItemMenu[];
}

/**
 * Antes vivían sueltos junto a Dashboard. Siguen sin encajar en el molde de
 * 5 categorías de un dominio de negocio (Reportes es un hub transversal,
 * Mis Tareas es personal) — por eso NO son un `DominioMenu` más, es un grupo
 * colapsable aparte sin sub-categorías (ver el render dedicado en
 * SidebarErp.tsx, participa del mismo acordeón exclusivo que los dominios).
 */
export const GRUPO_MI_ESPACIO: GrupoUtilidades = {
  id: 'mi-espacio',
  etiqueta: 'Mi espacio',
  icono: LayoutGrid,
  items: [
    // "Reportes" se sacó de acá (2026-11-10) — ya está suelto arriba,
    // apuntando al hub /reportes (auditoría de navegación duplicada:
    // aparecía DOS veces en el sidebar al mismo tiempo, y esta versión
    // apuntaba además a /reportes/ventas, la ruta vieja de antes del hub).
    { id: 'mis-tareas', etiqueta: 'Mis tareas', ruta: '/mis-tareas', modulo: 'mistareas' },
    { id: 'notificaciones', etiqueta: 'Notificaciones', ruta: '/notificaciones', permisos: ['notificaciones.ver'] },
    { id: 'mensajes', etiqueta: 'Mensajes', ruta: '/mensajes', permisos: ['whatsapp.mensajes.ver'] },
    { id: 'ia', etiqueta: 'IA', ruta: '/ia', permisos: ['ia.usar'], modulo: 'ia' },
  ],
};

export function esVisible(item: ItemMenu, tienePermiso: (p: string) => boolean, tieneModulo: (m: string) => boolean): boolean {
  if (item.modulo && !tieneModulo(item.modulo)) return false;
  return !item.permisos || item.permisos.some(tienePermiso);
}
