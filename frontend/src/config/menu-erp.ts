import { BookOpen, Boxes, FolderKanban, Globe, Home, type LucideIcon, Megaphone, Plane, Receipt, ShieldCheck, ShoppingBag, Users } from 'lucide-react';

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
          { id: 'formas-pago', etiqueta: 'Formas de pago', ruta: '/formas-pago', permisos: ['admin.configuracion'] },
          { id: 'cajas', etiqueta: 'Cajas', ruta: '/cajas', permisos: ['pos.ver'] },
          { id: 'clientes', etiqueta: 'Clientes', ruta: '/contactos', permisos: ['clientes.ver', 'compras.ver'] },
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
          { id: 'cxc', etiqueta: 'Cuentas por cobrar', ruta: '/cuentas-por-cobrar', permisos: ['cuentasporcobrar.ver'], modulo: 'facturacion' },
        ],
      },
      { categoria: 'reportes', items: [{ id: 'reportes-ventas', etiqueta: 'Ventas y comisiones', ruta: '/reportes', permisos: ['reportes.ver'] }] },
      {
        categoria: 'configuracion',
        items: [
          { id: 'ncf', etiqueta: 'NCF', ruta: '/ncf', permisos: ['admin.configuracion'] },
          { id: 'consecutivos', etiqueta: 'Consecutivos', ruta: '/consecutivos', permisos: ['admin.configuracion'] },
          { id: 'autorizaciones', etiqueta: 'Autorizaciones', ruta: '/autorizaciones', permisos: ['admin.configuracion'] },
          // Antes en Catálogos — es un único formulario de parámetros
          // (monto por punto, mínimo para canjear), apagado por defecto, no
          // un listado que se visite seguido. Eso es Configuración.
          { id: 'lealtad', etiqueta: 'Lealtad', ruta: '/lealtad', permisos: ['lealtad.ver'] },
        ],
      },
    ],
  },
  {
    id: 'compras',
    etiqueta: 'Compras',
    icono: ShoppingBag,
    categorias: [
      { categoria: 'catalogos', items: [{ id: 'proveedores', etiqueta: 'Proveedores', ruta: '/contactos', permisos: ['compras.ver'] }] },
      { categoria: 'transacciones', items: [{ id: 'compra-nueva', etiqueta: 'Nueva orden de compra', ruta: '/compras', permisos: ['compras.crear'], modulo: 'compras' }] },
      {
        categoria: 'consultas',
        items: [
          { id: 'compras', etiqueta: 'Buscar órdenes de compra', ruta: '/compras', permisos: ['compras.ver'], modulo: 'compras' },
          { id: 'cxp', etiqueta: 'Cuentas por pagar', ruta: '/cuentas-por-pagar', permisos: ['cuentasporpagar.ver'], modulo: 'compras' },
        ],
      },
      { categoria: 'reportes', items: [{ id: 'reportes-compras', etiqueta: 'Compras', ruta: '/reportes', permisos: ['reportes.ver'] }] },
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
          { id: 'bodegas', etiqueta: 'Bodegas (Sucursales)', ruta: '/sucursales', permisos: ['sucursales.ver'] },
        ],
      },
      {
        categoria: 'transacciones',
        items: [
          { id: 'ajuste', etiqueta: 'Ajuste de inventario', ruta: '/inventario', permisos: ['inventario.ajustar'], modulo: 'inventario' },
          { id: 'transferencia', etiqueta: 'Transferencia entre bodegas', ruta: '/inventario', permisos: ['inventario.transferir'], modulo: 'inventario' },
          { id: 'conteo', etiqueta: 'Conteo físico', ruta: '/inventario/conteos', permisos: ['inventario.contar'], modulo: 'inventario' },
          // Antes en Configuración — es una acción (generar e imprimir en
          // lote), no un ajuste de una vez.
          { id: 'etiquetas', etiqueta: 'Etiquetas de código de barras', ruta: '/productos/etiquetas', permisos: ['precios.ver'], modulo: 'productos' },
        ],
      },
      {
        categoria: 'consultas',
        items: [
          { id: 'stock', etiqueta: 'Stock actual', ruta: '/inventario', permisos: ['inventario.ver'], modulo: 'inventario' },
          { id: 'alertas', etiqueta: 'Alertas de inventario', ruta: '/inventario/alertas', permisos: ['inventario.ver'], modulo: 'inventario' },
        ],
      },
      { categoria: 'reportes', items: [{ id: 'reportes-inventario', etiqueta: 'Inventario y rotación', ruta: '/reportes', permisos: ['reportes.ver'] }] },
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
          { id: 'tasas-cambio', etiqueta: 'Tasas de cambio', ruta: '/tasas-cambio', permisos: ['facturacion.crear'] },
          // Faltaba del todo — Contabilidad.tsx tiene esta pestaña y no
          // tenía ninguna entrada de menú (hallazgo de la auditoría).
          { id: 'catalogo-cuentas', etiqueta: 'Catálogo de cuentas', ruta: '/contabilidad', permisos: ['contabilidad.ver'] },
        ],
      },
      {
        categoria: 'transacciones',
        items: [
          { id: 'asiento', etiqueta: 'Asiento contable', ruta: '/contabilidad', permisos: ['contabilidad.editar'] },
          { id: 'conciliacion', etiqueta: 'Conciliación bancaria', ruta: '/bancos', permisos: ['contabilidad.conciliar'], modulo: 'bancos' },
          { id: 'gasto-menor', etiqueta: 'Registrar gasto menor', ruta: '/gastos-menores', permisos: ['gastosmenores.crear'], modulo: 'gastosmenores' },
          { id: 'cierre-periodo', etiqueta: 'Cierre de período', ruta: '/contabilidad', permisos: ['contabilidad.cerrarperiodo'] },
        ],
      },
      { categoria: 'consultas', items: [{ id: 'libro-mayor', etiqueta: 'Libro diario / mayor', ruta: '/contabilidad', permisos: ['contabilidad.ver'] }] },
      { categoria: 'reportes', items: [{ id: 'reportes-financieros', etiqueta: 'Fiscales DGII y financieros', ruta: '/reportes', permisos: ['reportes.ver'] }] },
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
          { id: 'empleados', etiqueta: 'Empleados', ruta: '/nomina', permisos: ['nomina.ver'], modulo: 'nomina' },
          { id: 'puestos', etiqueta: 'Puestos', ruta: '/puestos', permisos: ['nomina.ver'], modulo: 'nomina' },
          { id: 'plantillas-horario', etiqueta: 'Plantillas de horario', ruta: '/plantillas-horario', permisos: ['rrhh.ver'], modulo: 'nomina' },
          { id: 'feriados', etiqueta: 'Feriados', ruta: '/feriados', permisos: ['rrhh.ver'], modulo: 'nomina' },
        ],
      },
      {
        categoria: 'transacciones',
        items: [
          { id: 'procesar-nomina', etiqueta: 'Procesar nómina', ruta: '/nomina', permisos: ['nomina.editar'], modulo: 'nomina' },
          { id: 'horarios-empleado', etiqueta: 'Asignar horarios', ruta: '/horarios-empleado', permisos: ['rrhh.ver'], modulo: 'nomina' },
          { id: 'asistencia', etiqueta: 'Marcar asistencia', ruta: '/asistencia', permisos: ['rrhh.ver'], modulo: 'nomina' },
          { id: 'ausencias', etiqueta: 'Registrar ausencia', ruta: '/ausencias', permisos: ['rrhh.ver'], modulo: 'nomina' },
        ],
      },
      { categoria: 'consultas', items: [{ id: 'historial-nomina', etiqueta: 'Historial de nómina', ruta: '/nomina', permisos: ['nomina.ver'], modulo: 'nomina' }] },
      { categoria: 'reportes', items: [{ id: 'reportes-nomina', etiqueta: 'Nómina y asistencia', ruta: '/reportes', permisos: ['reportes.ver'] }] },
      {
        // "Tipos de ausencia" — el propio componente se llama
        // TiposAusenciaConfigPanel, define reglas (si descuenta de la
        // nómina), no es un listado que se visite seguido.
        categoria: 'configuracion',
        items: [{ id: 'tipos-ausencia', etiqueta: 'Tipos de ausencia', ruta: '/tipos-ausencia', permisos: ['rrhh.ver'], modulo: 'nomina' }],
      },
    ],
  },
  {
    id: 'seguridad',
    etiqueta: 'Seguridad y Administración',
    icono: ShieldCheck,
    categorias: [
      { categoria: 'catalogos', items: [] },
      { categoria: 'transacciones', items: [] },
      { categoria: 'consultas', items: [] },
      { categoria: 'reportes', items: [] },
      {
        categoria: 'configuracion',
        items: [
          { id: 'usuarios', etiqueta: 'Usuarios', ruta: '/usuarios', permisos: ['admin.usuarios'] },
          { id: 'roles', etiqueta: 'Roles y permisos', ruta: '/roles-permisos', permisos: ['admin.usuarios'] },
          { id: 'datos-empresa', etiqueta: 'Datos de mi empresa', ruta: '/datos-empresa', permisos: ['admin.configuracion'] },
          { id: 'pasarela-pago', etiqueta: 'Pasarela de pago', ruta: '/pasarela-pago', permisos: ['admin.configuracion'] },
          { id: 'parametros', etiqueta: 'Parámetros generales', ruta: '/parametros', permisos: ['admin.configuracion'] },
          { id: 'documentos', etiqueta: 'Documentos (branding)', ruta: '/documentos', permisos: ['admin.configuracion'] },
          { id: 'webhooks', etiqueta: 'Webhooks', ruta: '/webhooks', permisos: ['admin.configuracion'] },
          { id: 'whatsapp-config', etiqueta: 'WhatsApp', ruta: '/whatsapp-config', permisos: ['admin.configuracion'] },
          { id: 'correo-config', etiqueta: 'Correo (SMTP)', ruta: '/correo-config', permisos: ['admin.configuracion'] },
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
    id: 'inmobiliaria',
    etiqueta: 'Inmobiliaria',
    icono: Home,
    categorias: [
      { categoria: 'catalogos', items: [{ id: 'propiedades', etiqueta: 'Propiedades', ruta: '/propiedades', permisos: ['inmobiliaria.propiedades.ver'], modulo: 'inmobiliaria' }] },
      {
        categoria: 'transacciones',
        items: [
          { id: 'contrato-nuevo', etiqueta: 'Contratos', ruta: '/contratos-propiedad', permisos: ['inmobiliaria.contratos.ver'], modulo: 'inmobiliaria' },
          { id: 'alquileres', etiqueta: 'Cobrar alquileres', ruta: '/alquileres', permisos: ['inmobiliaria.alquileres.ver'], modulo: 'inmobiliaria' },
        ],
      },
      { categoria: 'consultas', items: [] },
      { categoria: 'reportes', items: [] },
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'travel',
    etiqueta: 'Viajes',
    icono: Plane,
    categorias: [
      { categoria: 'catalogos', items: [] },
      { categoria: 'transacciones', items: [{ id: 'reservar-vuelo', etiqueta: 'Buscar y reservar vuelo', ruta: '/travel/reservas', permisos: ['travel.reservar'], modulo: 'travel' }] },
      { categoria: 'consultas', items: [{ id: 'reservas', etiqueta: 'Mis reservas', ruta: '/travel/reservas', permisos: ['travel.ver'], modulo: 'travel' }] },
      { categoria: 'reportes', items: [] },
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
      { categoria: 'reportes', items: [] },
      { categoria: 'configuracion', items: [] },
    ],
  },
  {
    id: 'tienda',
    etiqueta: 'Tienda Online',
    icono: Globe,
    categorias: [
      { categoria: 'catalogos', items: [{ id: 'secciones-home', etiqueta: 'Secciones del Home', ruta: '/tienda-online', permisos: ['admin.configuracion'], modulo: 'ecommerce' }] },
      { categoria: 'transacciones', items: [{ id: 'pedidos', etiqueta: 'Gestionar pedidos', ruta: '/tienda-online', permisos: ['admin.configuracion'], modulo: 'ecommerce' }] },
      { categoria: 'consultas', items: [] },
      { categoria: 'reportes', items: [] },
      { categoria: 'configuracion', items: [{ id: 'tienda-config', etiqueta: 'Dominio propio y branding', ruta: '/tienda-online', permisos: ['admin.configuracion'], modulo: 'ecommerce' }] },
    ],
  },
];

/**
 * Utilidades sin dominio (antes "sueltos arriba" del Sidebar) — Reportes es
 * un hub transversal, Mis Tareas es personal, ninguno encaja en el molde de
 * 5 categorías de un dominio de negocio.
 */
export const UTILIDADES_GENERALES: ItemMenu[] = [
  { id: 'dashboard', etiqueta: 'Dashboard', ruta: '/', permisos: ['reportes.ver'] },
  { id: 'reportes', etiqueta: 'Reportes', ruta: '/reportes', permisos: ['reportes.ver'] },
  { id: 'mis-tareas', etiqueta: 'Mis tareas', ruta: '/mis-tareas', modulo: 'mistareas' },
  { id: 'notificaciones', etiqueta: 'Notificaciones', ruta: '/notificaciones', permisos: ['notificaciones.ver'] },
  { id: 'mensajes', etiqueta: 'Mensajes', ruta: '/mensajes', permisos: ['whatsapp.mensajes.ver'] },
  { id: 'ia', etiqueta: 'IA', ruta: '/ia', permisos: ['ia.usar'], modulo: 'ia' },
];

export function esVisible(item: ItemMenu, tienePermiso: (p: string) => boolean, tieneModulo: (m: string) => boolean): boolean {
  if (item.modulo && !tieneModulo(item.modulo)) return false;
  return !item.permisos || item.permisos.some(tienePermiso);
}
