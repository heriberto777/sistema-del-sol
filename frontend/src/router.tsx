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
import { Cotizaciones } from './pages/Cotizaciones';
import { Remisiones } from './pages/Remisiones';
import { NotasCredito } from './pages/NotasCredito';
import { CuentasPorCobrar } from './pages/CuentasPorCobrar';
import { CuentasPorPagar } from './pages/CuentasPorPagar';
import { Inventario } from './pages/Inventario';
import { Sucursales } from './pages/Sucursales';
import { Compras } from './pages/Compras';
import { Contactos } from './pages/Contactos';
import { Productos } from './pages/Productos';
import { Reportes } from './pages/Reportes';
import { Contabilidad } from './pages/Contabilidad';
import { Nomina } from './pages/Nomina';
import { RRHH } from './pages/RRHH';
import { Pos } from './pages/Pos';
import { PosCaja } from './pages/PosCaja';
import { Ia } from './pages/Ia';
import { Notificaciones } from './pages/Notificaciones';
import { Bancos } from './pages/Bancos';
import { GastosMenores } from './pages/GastosMenores';
import { TiendaOnline } from './pages/TiendaOnline';
import { Admin } from './pages/Admin';
import { PlatformLogin } from './pages/PlatformLogin';
import { PlatformDashboard } from './pages/PlatformDashboard';
import { PlatformTenants } from './pages/PlatformTenants';
import { PlatformPlanes } from './pages/PlatformPlanes';
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
import { TiendaProducto } from './pages/tienda/TiendaProducto';
import { TiendaCategoria } from './pages/tienda/TiendaCategoria';
import { TiendaCarrito } from './pages/tienda/TiendaCarrito';
import { TiendaCheckout } from './pages/tienda/TiendaCheckout';
import { TiendaLogin } from './pages/tienda/TiendaLogin';
import { TiendaRegistro } from './pages/tienda/TiendaRegistro';
import { TiendaMisPedidos } from './pages/tienda/TiendaMisPedidos';

// Subdominios que nunca son un tenant — mismo criterio que
// `backend/src/tenants/subdominios-reservados.ts` (SUBDOMINIOS_RESERVADOS),
// acá solo importan los que de verdad resuelven a esta app por DNS:
// `app.dominio.com` es el panel de admin fijo de TODOS los tenants,
// `www.dominio.com` cae al mismo lugar por si alguien lo escribe así.
const HOSTS_ADMIN = new Set(['app', 'www']);

/**
 * Resuelve si el hostname real (`window.location.hostname`) es el de un
 * tenant (`<subdominio>.dominio.com`, producción) — en ese caso la
 * tienda se monta directo en "/", sin pedir `/tienda/:subdominio` en la
 * URL visible (pedido explícito: la URL de la tienda tiene que ser
 * amigable, un cliente real nunca va a escribir `/tienda/demo` a mano).
 * `null` = esta es la app de administración (incluye `localhost` en
 * desarrollo, donde se sigue usando `/tienda/:subdominio` tal cual).
 */
function resolverContextoTienda(): string | null {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
  const labels = hostname.split('.');
  // Dominio raíz sin ningún subdominio (ej. "midominio.com") — no hay
  // forma de saber a qué tenant se refiere, cae a la app de admin.
  if (labels.length < 3) return null;
  const primerLabel = labels[0].toLowerCase();
  return HOSTS_ADMIN.has(primerLabel) ? null : primerLabel;
}

const RUTAS_TIENDA_PUBLICA = [
  { index: true, element: <TiendaHome /> },
  { path: 'producto/:productoId', element: <TiendaProducto /> },
  { path: 'categoria/:categoriaId', element: <TiendaCategoria /> },
  { path: 'carrito', element: <TiendaCarrito /> },
  { path: 'checkout', element: <TiendaCheckout /> },
  { path: 'login', element: <TiendaLogin /> },
  { path: 'registro', element: <TiendaRegistro /> },
  { path: 'mis-pedidos', element: <TiendaMisPedidos /> },
];

const subdominioDeHostname = resolverContextoTienda();

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
          { path: '/cotizaciones', element: <Cotizaciones /> },
          { path: '/remisiones', element: <Remisiones /> },
          { path: '/notas-credito', element: <NotasCredito /> },
          { path: '/cuentas-por-cobrar', element: <CuentasPorCobrar /> },
          { path: '/cuentas-por-pagar', element: <CuentasPorPagar /> },
          { path: '/inventario', element: <Inventario /> },
          { path: '/sucursales', element: <Sucursales /> },
          { path: '/compras', element: <Compras /> },
          { path: '/contactos', element: <Contactos /> },
          { path: '/clientes', element: <Navigate to="/contactos" replace /> },
          { path: '/productos', element: <Productos /> },
          { path: '/reportes', element: <Reportes /> },
          { path: '/contabilidad', element: <Contabilidad /> },
          { path: '/bancos', element: <Bancos /> },
          { path: '/gastos-menores', element: <GastosMenores /> },
          { path: '/tienda-online', element: <TiendaOnline /> },
          { path: '/nomina', element: <Nomina /> },
          { path: '/rrhh', element: <RRHH /> },
          { path: '/pos', element: <Pos /> },
          { path: '/ia', element: <Ia /> },
          { path: '/notificaciones', element: <Notificaciones /> },
          { path: '/admin', element: <Admin /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(subdominioDeHostname ? RUTAS_HOSTNAME_TENANT : RUTAS_ADMIN);
