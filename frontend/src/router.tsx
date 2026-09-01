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

export const router = createBrowserRouter([
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
]);
