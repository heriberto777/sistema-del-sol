import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/templates/AppLayout/AppLayout';
import { PlatformLayout } from './components/templates/PlatformLayout/PlatformLayout';
import { NoEncontrado } from './pages/NoEncontrado';
import { RutaProtegida } from './components/organisms/RutaProtegida/RutaProtegida';
import { RutaProtegidaPlataforma } from './components/organisms/RutaProtegidaPlataforma/RutaProtegidaPlataforma';
import { Login } from './pages/Login';
import { OlvidePassword } from './pages/OlvidePassword';
import { RestablecerPassword } from './pages/RestablecerPassword';
import { PlatformOlvidePassword } from './pages/PlatformOlvidePassword';
import { PlatformRestablecerPassword } from './pages/PlatformRestablecerPassword';
import { Dashboard } from './pages/Dashboard';
import { Facturacion } from './pages/Facturacion';
import { FacturacionNueva } from './pages/FacturacionNueva';
import { Cotizaciones } from './pages/Cotizaciones';
import { CotizacionNueva } from './pages/CotizacionNueva';
import { CotizacionEditar } from './pages/CotizacionEditar';
import { Remisiones } from './pages/Remisiones';
import { RemisionNueva } from './pages/RemisionNueva';
import { RemisionEditar } from './pages/RemisionEditar';
import { NotasCredito } from './pages/NotasCredito';
import { CuentasPorCobrar } from './pages/CuentasPorCobrar';
import { CuentasPorPagar } from './pages/CuentasPorPagar';
import { Inventario } from './pages/Inventario';
import { Conteos } from './pages/Conteos';
import { ConteoDetalle } from './pages/ConteoDetalle';
import { InventarioAlertas } from './pages/InventarioAlertas';
import { Sucursales } from './pages/Sucursales';
import { Compras } from './pages/Compras';
import { Contactos } from './pages/Contactos';
import { Productos } from './pages/Productos';
import { EtiquetasCodigoBarras } from './pages/EtiquetasCodigoBarras';
import { Reportes } from './pages/Reportes';
import { Contabilidad } from './pages/Contabilidad';
import { Nomina } from './pages/Nomina';
import { RRHH } from './pages/RRHH';
import { Pos } from './pages/Pos';
import { PosCaja } from './pages/PosCaja';
import { Ia } from './pages/Ia';
import { Notificaciones } from './pages/Notificaciones';
import { Mensajes } from './pages/Mensajes';
import { Bancos } from './pages/Bancos';
import { GastosMenores } from './pages/GastosMenores';
import { Proyectos } from './pages/Proyectos';
import { Propiedades } from './pages/Propiedades';
import { MisTareas } from './pages/MisTareas';
import { TravelReservas } from './pages/TravelReservas';
import { Contratos } from './pages/Contratos';
import { CobrosAlquiler } from './pages/CobrosAlquiler';
import { InmobiliariaPublicaLayout } from './pages/inmobiliaria/InmobiliariaPublicaLayout';
import { PropiedadesPublico } from './pages/inmobiliaria/PropiedadesPublico';
import { PropiedadPublicoDetalle } from './pages/inmobiliaria/PropiedadPublicoDetalle';
import { PropiedadesFavoritas } from './pages/inmobiliaria/PropiedadesFavoritas';
import { ProyectoDetalle } from './pages/ProyectoDetalle';
import { PublicacionesSociales } from './pages/PublicacionesSociales';
import { TiendaOnline } from './pages/TiendaOnline';
import { Admin } from './pages/Admin';
import { PlatformLogin } from './pages/PlatformLogin';
import { PlatformDashboard } from './pages/PlatformDashboard';
import { PlatformTenants } from './pages/PlatformTenants';
import { PlatformPlanes } from './pages/PlatformPlanes';
import { PlatformCupones } from './pages/PlatformCupones';
import { PlatformRoles } from './pages/PlatformRoles';
import { PlatformAdmins } from './pages/PlatformAdmins';
import { PlatformFacturas } from './pages/PlatformFacturas';
import { PlatformActividad } from './pages/PlatformActividad';
import { PlatformConfiguracion } from './pages/PlatformConfiguracion';
import { PagarFactura } from './pages/PagarFactura';
import { PagoExitoso } from './pages/PagoExitoso';
import { PagoCancelado } from './pages/PagoCancelado';
import { CobroFactura } from './pages/CobroFactura';
import { CobroFacturaResultado } from './pages/CobroFacturaResultado';
import { VerFactura, VerCotizacion } from './pages/VerDocumentoPublico';
import { TiendaLayout } from './pages/tienda/TiendaLayout';
import { TiendaHome } from './pages/tienda/TiendaHome';
import { TiendaProductos } from './pages/tienda/TiendaProductos';
import { TiendaProducto } from './pages/tienda/TiendaProducto';
import { TiendaCategoria } from './pages/tienda/TiendaCategoria';
import { TiendaCarrito } from './pages/tienda/TiendaCarrito';
import { TiendaCheckout } from './pages/tienda/TiendaCheckout';
import { TiendaLogin } from './pages/tienda/TiendaLogin';
import { TiendaRegistro } from './pages/tienda/TiendaRegistro';
import { TiendaMisPedidos } from './pages/tienda/TiendaMisPedidos';

const RUTAS_TIENDA_PUBLICA = [
  { index: true, element: <TiendaHome /> },
  { path: 'productos', element: <TiendaProductos /> },
  { path: 'producto/:productoId', element: <TiendaProducto /> },
  { path: 'categoria/:categoriaId', element: <TiendaCategoria /> },
  { path: 'carrito', element: <TiendaCarrito /> },
  { path: 'checkout', element: <TiendaCheckout /> },
  { path: 'login', element: <TiendaLogin /> },
  { path: 'registro', element: <TiendaRegistro /> },
  { path: 'mis-pedidos', element: <TiendaMisPedidos /> },
];

// Estamos en <subdominio>.dominio.com — nada de rutas de admin/plataforma
// acá, esto SOLO puede ser la tienda pública de ese tenant. TiendaLayout/
// las páginas de tienda resuelven el subdominio vía useSubdominioTienda()
// (hostname, no useParams).
//
// El segundo bloque (`/tienda/:subdominio`) queda TAMBIÉN disponible acá
// a propósito: las 17 plantillas + componentes compartidos (tarjetas de
// producto, drawer de carrito, etc.) arman sus enlaces internos con la
// ruta completa `/tienda/${subdominio}/...` en decenas de lugares —
// reescribir todos esos enlaces para que sean relativos al hostname es
// un cambio grande y riesgoso que no hacía falta para resolver el pedido
// real (que la URL de ENTRADA sea limpia, `demo.dominio.com`, no que
// cada clic interno la mantenga así). Con este fallback, cualquier link
// interno que genere `/tienda/demo/producto/123` sigue funcionando
// perfecto en `demo.dominio.com/tienda/demo/producto/123` — el mismo
// tenant, resuelto de nuevo por el `:subdominio` de la URL en vez del
// hostname, sin duplicar nada. Si más adelante se quiere que TODA la
// navegación (no solo la entrada) quede sin `/tienda/demo`, es un
// trabajo aparte de reescribir esos enlaces uno por uno.
const RUTAS_HOSTNAME_TENANT = [
  { path: '/', element: <TiendaLayout />, children: RUTAS_TIENDA_PUBLICA },
  { path: '/tienda/:subdominio', element: <TiendaLayout />, children: RUTAS_TIENDA_PUBLICA },
  { path: '*', element: <NoEncontrado /> },
];

const RUTAS_ADMIN = [
  { path: '*', element: <NoEncontrado /> },
  { path: '/login', element: <Login /> },
  { path: '/olvide-password', element: <OlvidePassword /> },
  { path: '/restablecer-password', element: <RestablecerPassword /> },
  { path: '/plataforma/login', element: <PlatformLogin /> },
  { path: '/plataforma/olvide-password', element: <PlatformOlvidePassword /> },
  { path: '/plataforma/restablecer-password', element: <PlatformRestablecerPassword /> },
  { path: '/pagar/:facturaId', element: <PagarFactura /> },
  { path: '/pagar/:facturaId/exito', element: <PagoExitoso /> },
  { path: '/pagar/:facturaId/cancelado', element: <PagoCancelado /> },
  // Cobro de Factura de TENANT (ítem C-1) — distinto de /pagar/:facturaId (pasarela de PLATAFORMA).
  { path: '/pagar-factura/:facturaId', element: <CobroFactura /> },
  { path: '/pagar-factura/:facturaId/resultado', element: <CobroFacturaResultado /> },
  // Ítem H-4 — link público de solo lectura, sin sesión (llega en el
  // email/WhatsApp de "factura creada"/"cotización enviada").
  { path: '/ver-factura/:id', element: <VerFactura /> },
  { path: '/ver-cotizacion/:id', element: <VerCotizacion /> },
  // Storefront público del plugin Tienda Online (Fase 2) — sin AppLayout/auth.
  // Solo se llega acá tipeando la URL a mano en desarrollo (localhost) o como
  // fallback — en producción, la tienda vive en <subdominio>.dominio.com (ver
  // RUTAS_HOSTNAME_TENANT arriba). Anidadas bajo TiendaLayout (Fase 9) para
  // que el drawer de carrito se pueda abrir desde cualquiera de ellas.
  {
    path: '/tienda/:subdominio',
    element: <TiendaLayout />,
    children: RUTAS_TIENDA_PUBLICA,
  },
  // Catálogo público del plugin Inmobiliaria (Fase 2) — sin AppLayout/auth,
  // mismo criterio que /tienda/:subdominio arriba.
  {
    path: '/inmobiliaria/:subdominio',
    element: <InmobiliariaPublicaLayout />,
    children: [
      { index: true, element: <PropiedadesPublico /> },
      { path: 'favoritos', element: <PropiedadesFavoritas /> },
      { path: ':propiedadId', element: <PropiedadPublicoDetalle /> },
    ],
  },
  {
    element: <RutaProtegidaPlataforma />,
    children: [
      {
        element: <PlatformLayout />,
        children: [
          { path: '/plataforma', element: <Navigate to="/plataforma/dashboard" replace /> },
          { path: '/plataforma/dashboard', element: <PlatformDashboard /> },
          { path: '/plataforma/tenants', element: <PlatformTenants /> },
          { path: '/plataforma/planes', element: <PlatformPlanes /> },
          { path: '/plataforma/cupones', element: <PlatformCupones /> },
          { path: '/plataforma/roles', element: <PlatformRoles /> },
          { path: '/plataforma/admins', element: <PlatformAdmins /> },
          { path: '/plataforma/facturas', element: <PlatformFacturas /> },
          { path: '/plataforma/actividad', element: <PlatformActividad /> },
          { path: '/plataforma/configuracion', element: <PlatformConfiguracion /> },
        ],
      },
    ],
  },
  {
    element: <RutaProtegida />,
    children: [
      // Fuera de AppLayout a propósito — pantalla completa dedicada del
      // POS (sin sidebar/header), mismo criterio que /pagar/:facturaId.
      { path: '/pos/caja/:turnoId', element: <PosCaja /> },
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/facturacion', element: <Facturacion /> },
          { path: '/facturacion/nueva', element: <FacturacionNueva /> },
          { path: '/cotizaciones', element: <Cotizaciones /> },
          { path: '/cotizaciones/nueva', element: <CotizacionNueva /> },
          { path: '/cotizaciones/:id/editar', element: <CotizacionEditar /> },
          { path: '/remisiones', element: <Remisiones /> },
          { path: '/remisiones/nueva', element: <RemisionNueva /> },
          { path: '/remisiones/:id/editar', element: <RemisionEditar /> },
          { path: '/notas-credito', element: <NotasCredito /> },
          { path: '/cuentas-por-cobrar', element: <CuentasPorCobrar /> },
          { path: '/cuentas-por-pagar', element: <CuentasPorPagar /> },
          { path: '/inventario', element: <Inventario /> },
          { path: '/inventario/conteos', element: <Conteos /> },
          { path: '/inventario/conteos/:id', element: <ConteoDetalle /> },
          { path: '/inventario/alertas', element: <InventarioAlertas /> },
          { path: '/sucursales', element: <Sucursales /> },
          { path: '/compras', element: <Compras /> },
          { path: '/contactos', element: <Contactos /> },
          { path: '/clientes', element: <Navigate to="/contactos" replace /> },
          { path: '/productos', element: <Productos /> },
          { path: '/productos/etiquetas', element: <EtiquetasCodigoBarras /> },
          { path: '/reportes', element: <Reportes /> },
          { path: '/mis-tareas', element: <MisTareas /> },
          { path: '/travel/reservas', element: <TravelReservas /> },
          { path: '/contabilidad', element: <Contabilidad /> },
          { path: '/bancos', element: <Bancos /> },
          { path: '/gastos-menores', element: <GastosMenores /> },
          { path: '/proyectos', element: <Proyectos /> },
          { path: '/proyectos/:id', element: <ProyectoDetalle /> },
          { path: '/propiedades', element: <Propiedades /> },
          { path: '/contratos-propiedad', element: <Contratos /> },
          { path: '/alquileres', element: <CobrosAlquiler /> },
          { path: '/publicaciones-sociales', element: <PublicacionesSociales /> },
          { path: '/tienda-online', element: <TiendaOnline /> },
          { path: '/nomina', element: <Nomina /> },
          { path: '/rrhh', element: <RRHH /> },
          { path: '/pos', element: <Pos /> },
          { path: '/ia', element: <Ia /> },
          { path: '/notificaciones', element: <Notificaciones /> },
          { path: '/mensajes', element: <Mensajes /> },
          { path: '/admin', element: <Admin /> },
        ],
      },
    ],
  },
];

/**
 * `subdominio` ya viene resuelto por `App.tsx` (síncrono para
 * localhost/`*.ciguadev.com`, async vía `resolverSubdominioPorDominioPropio`
 * para un dominio propio — ver `lib/resolver-subdominio-tienda.ts`) antes
 * de llamar a esto, así que acá no queda ninguna lógica de hostname.
 */
export function crearRouter(subdominio: string | null) {
  return createBrowserRouter(subdominio ? RUTAS_HOSTNAME_TENANT : RUTAS_ADMIN);
}
