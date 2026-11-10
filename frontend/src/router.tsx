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
import { FacturasProveedor } from './pages/FacturasProveedor';
import { FacturaProveedorNueva } from './pages/FacturaProveedorNueva';
import { TerminosPago } from './pages/TerminosPago';
import { InventarioStock } from './pages/inventario/InventarioStock';
import { InventarioAjustes } from './pages/inventario/InventarioAjustes';
import { InventarioTransferencias } from './pages/inventario/InventarioTransferencias';
import { InventarioAjusteNuevo } from './pages/InventarioAjusteNuevo';
import { InventarioTransferenciaNueva } from './pages/InventarioTransferenciaNueva';
import { Conteos } from './pages/Conteos';
import { ConteoDetalle } from './pages/ConteoDetalle';
import { InventarioAlertas } from './pages/InventarioAlertas';
import { ConfiguracionInventario } from './pages/ConfiguracionInventario';
import { Sucursales } from './pages/Sucursales';
import { Compras } from './pages/Compras';
import { OrdenCompraNueva } from './pages/OrdenCompraNueva';
import { Clientes } from './pages/Clientes';
import { ClienteFormulario } from './pages/ClienteFormulario';
import { Proveedores } from './pages/Proveedores';
import { ProveedorFormulario } from './pages/ProveedorFormulario';
import { Productos } from './pages/Productos';
import { ProductoFormulario } from './pages/ProductoFormulario';
import { EtiquetasCodigoBarras } from './pages/EtiquetasCodigoBarras';
import { Categorias } from './pages/Categorias';
import { NivelesPrecio } from './pages/NivelesPrecio';
import { Atributos } from './pages/Atributos';
import { Ofertas } from './pages/Ofertas';
import { Bonos } from './pages/Bonos';
import { Lealtad } from './pages/Lealtad';
import { Cajas } from './pages/Cajas';
import { FormasPago } from './pages/FormasPago';
import { ReportesVentas } from './pages/reportes/ReportesVentas';
import { ReportesVentasAgrupadas } from './pages/reportes/ReportesVentasAgrupadas';
import { ReportesRentabilidad } from './pages/reportes/ReportesRentabilidad';
import { ReportesComisiones } from './pages/reportes/ReportesComisiones';
import { ReportesCompras } from './pages/reportes/ReportesCompras';
import { ReportesInventario } from './pages/reportes/ReportesInventario';
import { ReportesInmobiliaria } from './pages/reportes/ReportesInmobiliaria';
import { ReportesPublicacionesSociales } from './pages/reportes/ReportesPublicacionesSociales';
import { ReportesTiendaOnline } from './pages/reportes/ReportesTiendaOnline';
import { ReportesRetencionesProveedores } from './pages/reportes/ReportesRetencionesProveedores';
import { ContabilidadCuentas } from './pages/contabilidad/ContabilidadCuentas';
import { ContabilidadAsientos } from './pages/contabilidad/ContabilidadAsientos';
import { AsientoContableNuevo } from './pages/AsientoContableNuevo';
import { ContabilidadGastoRapido } from './pages/contabilidad/ContabilidadGastoRapido';
import { ContabilidadBalanceGeneral } from './pages/contabilidad/ContabilidadBalanceGeneral';
import { ContabilidadEstadoResultados } from './pages/contabilidad/ContabilidadEstadoResultados';
import { ContabilidadBalanceComprobacion } from './pages/contabilidad/ContabilidadBalanceComprobacion';
import { ContabilidadLibroMayor } from './pages/contabilidad/ContabilidadLibroMayor';
import { ContabilidadConciliacion } from './pages/contabilidad/ContabilidadConciliacion';
import { ContabilidadCierre } from './pages/contabilidad/ContabilidadCierre';
import { ContabilidadFiscal } from './pages/contabilidad/ContabilidadFiscal';
import { NominaEmpleados } from './pages/nomina/NominaEmpleados';
import { NominaPeriodos } from './pages/nomina/NominaPeriodos';
import { NominaRetenciones } from './pages/nomina/NominaRetenciones';
import { Puestos } from './pages/Puestos';
import { PlantillasHorario } from './pages/PlantillasHorario';
import { Feriados } from './pages/Feriados';
import { TiposAusencia } from './pages/TiposAusencia';
import { Asistencia } from './pages/Asistencia';
import { Ausencias } from './pages/Ausencias';
import { HorariosEmpleado } from './pages/HorariosEmpleado';
import { Pos } from './pages/Pos';
import { PosCaja } from './pages/PosCaja';
import { Ia } from './pages/Ia';
import { Notificaciones } from './pages/Notificaciones';
import { PlantillasNotificacion } from './pages/PlantillasNotificacion';
import { FormatoDocumentos } from './pages/FormatoDocumentos';
import { Mensajes } from './pages/Mensajes';
import { Bancos } from './pages/Bancos';
import { GastosMenores } from './pages/GastosMenores';
import { Proyectos } from './pages/Proyectos';
import { Propiedades } from './pages/Propiedades';
import { MisTareas } from './pages/MisTareas';
import { Auditoria } from './pages/Auditoria';
import { CrmLeads } from './pages/CrmLeads';
import { CrmPipeline } from './pages/CrmPipeline';
import { CrmEtapasPipeline } from './pages/CrmEtapasPipeline';
import { CrmDashboard } from './pages/CrmDashboard';
import { CrmMetasVenta } from './pages/CrmMetasVenta';
import { TravelResumen } from './pages/travel/TravelResumen';
import { TravelReservasLista } from './pages/travel/TravelReservasLista';
import { TravelBuscarVuelo } from './pages/travel/TravelBuscarVuelo';
import { TravelBuscarHotel } from './pages/travel/TravelBuscarHotel';
import { TravelMarkup } from './pages/travel/TravelMarkup';
import { Contratos } from './pages/Contratos';
import { CobrosAlquiler } from './pages/CobrosAlquiler';
import { InmobiliariaPublicaLayout } from './pages/inmobiliaria/InmobiliariaPublicaLayout';
import { PropiedadesPublico } from './pages/inmobiliaria/PropiedadesPublico';
import { PropiedadPublicoDetalle } from './pages/inmobiliaria/PropiedadPublicoDetalle';
import { PropiedadesFavoritas } from './pages/inmobiliaria/PropiedadesFavoritas';
import { ProyectoDetalle } from './pages/ProyectoDetalle';
import { PublicacionesSociales } from './pages/PublicacionesSociales';
import { TiendaOnlineSecciones } from './pages/tienda-online/TiendaOnlineSecciones';
import { TiendaOnlinePedidos } from './pages/tienda-online/TiendaOnlinePedidos';
import { TiendaOnlineConfiguracion } from './pages/tienda-online/TiendaOnlineConfiguracion';
import { Usuarios } from './pages/Usuarios';
import { RolesPermisos } from './pages/RolesPermisos';
import { Configuracion } from './pages/Configuracion';
import { Reportes } from './pages/Reportes';
import { DatosEmpresa } from './pages/DatosEmpresa';
import { Ncf } from './pages/Ncf';
import { Consecutivos } from './pages/Consecutivos';
import { Autorizaciones } from './pages/Autorizaciones';
import { PasarelaPago } from './pages/PasarelaPago';
import { CategoriasCliente } from './pages/CategoriasCliente';
import { CategoriasProveedor } from './pages/CategoriasProveedor';
import { LeyesFiscales } from './pages/LeyesFiscales';
import { TasasCambio } from './pages/TasasCambio';
import { Parametros } from './pages/Parametros';
import { Documentos } from './pages/Documentos';
import { Webhooks } from './pages/Webhooks';
import { WhatsappConfig } from './pages/WhatsappConfig';
import { TravelConfig } from './pages/TravelConfig';
import { CorreoConfig } from './pages/CorreoConfig';
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
          { path: '/plataforma/configuracion/:tab', element: <PlatformConfiguracion /> },
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
          { path: '/ofertas', element: <Ofertas /> },
          { path: '/bonos', element: <Bonos /> },
          { path: '/lealtad', element: <Lealtad /> },
          { path: '/cajas', element: <Cajas /> },
          { path: '/formas-pago', element: <FormasPago /> },
          { path: '/cuentas-por-cobrar', element: <CuentasPorCobrar /> },
          { path: '/cuentas-por-pagar', element: <CuentasPorPagar /> },
          { path: '/facturas-proveedor', element: <FacturasProveedor /> },
          { path: '/facturas-proveedor/nueva', element: <FacturaProveedorNueva /> },
          { path: '/terminos-pago', element: <TerminosPago /> },
          { path: '/inventario/stock', element: <InventarioStock /> },
          { path: '/inventario/ajustes', element: <InventarioAjustes /> },
          { path: '/inventario/ajustes/nuevo', element: <InventarioAjusteNuevo /> },
          { path: '/inventario/transferencias', element: <InventarioTransferencias /> },
          { path: '/inventario/transferencias/nuevo', element: <InventarioTransferenciaNueva /> },
          { path: '/inventario/conteos', element: <Conteos /> },
          { path: '/inventario/conteos/:id', element: <ConteoDetalle /> },
          { path: '/inventario/alertas', element: <InventarioAlertas /> },
          { path: '/inventario/configuracion', element: <ConfiguracionInventario /> },
          { path: '/sucursales', element: <Sucursales /> },
          { path: '/compras', element: <Compras /> },
          { path: '/compras/nueva', element: <OrdenCompraNueva /> },
          { path: '/clientes', element: <Clientes /> },
          { path: '/clientes/nuevo', element: <ClienteFormulario /> },
          { path: '/clientes/:id', element: <ClienteFormulario /> },
          { path: '/clientes/:id/editar', element: <ClienteFormulario /> },
          { path: '/proveedores', element: <Proveedores /> },
          { path: '/proveedores/nuevo', element: <ProveedorFormulario /> },
          { path: '/proveedores/:id', element: <ProveedorFormulario /> },
          { path: '/proveedores/:id/editar', element: <ProveedorFormulario /> },
          { path: '/contactos', element: <Navigate to="/clientes" replace /> },
          { path: '/productos', element: <Productos /> },
          { path: '/productos/nuevo', element: <ProductoFormulario /> },
          { path: '/productos/:id', element: <ProductoFormulario /> },
          { path: '/productos/:id/editar', element: <ProductoFormulario /> },
          { path: '/productos/etiquetas', element: <EtiquetasCodigoBarras /> },
          { path: '/categorias', element: <Categorias /> },
          { path: '/niveles-precio', element: <NivelesPrecio /> },
          { path: '/atributos', element: <Atributos /> },
          { path: '/reportes/ventas', element: <ReportesVentas /> },
          { path: '/reportes/ventas-agrupadas', element: <ReportesVentasAgrupadas /> },
          { path: '/reportes/rentabilidad', element: <ReportesRentabilidad /> },
          { path: '/reportes/comisiones', element: <ReportesComisiones /> },
          { path: '/reportes/compras', element: <ReportesCompras /> },
          { path: '/reportes/inventario', element: <ReportesInventario /> },
          { path: '/reportes/inmobiliaria', element: <ReportesInmobiliaria /> },
          { path: '/reportes/publicaciones-sociales', element: <ReportesPublicacionesSociales /> },
          { path: '/reportes/tienda-online', element: <ReportesTiendaOnline /> },
          { path: '/reportes/retenciones-proveedores', element: <ReportesRetencionesProveedores /> },
          { path: '/mis-tareas', element: <MisTareas /> },
          { path: '/travel/resumen', element: <TravelResumen /> },
          { path: '/travel/reservas', element: <TravelReservasLista /> },
          { path: '/travel/buscar-vuelo', element: <TravelBuscarVuelo /> },
          { path: '/travel/buscar-hotel', element: <TravelBuscarHotel /> },
          { path: '/travel/markup', element: <TravelMarkup /> },
          { path: '/contabilidad/cuentas', element: <ContabilidadCuentas /> },
          { path: '/contabilidad/asientos', element: <ContabilidadAsientos /> },
          { path: '/contabilidad/asientos/nuevo', element: <AsientoContableNuevo /> },
          { path: '/contabilidad/gasto-rapido', element: <ContabilidadGastoRapido /> },
          { path: '/contabilidad/balance-general', element: <ContabilidadBalanceGeneral /> },
          { path: '/contabilidad/estado-resultados', element: <ContabilidadEstadoResultados /> },
          { path: '/contabilidad/balance-comprobacion', element: <ContabilidadBalanceComprobacion /> },
          { path: '/contabilidad/libro-mayor', element: <ContabilidadLibroMayor /> },
          { path: '/contabilidad/conciliacion', element: <ContabilidadConciliacion /> },
          { path: '/contabilidad/cierre', element: <ContabilidadCierre /> },
          { path: '/contabilidad/fiscal', element: <ContabilidadFiscal /> },
          { path: '/bancos', element: <Bancos /> },
          { path: '/gastos-menores', element: <GastosMenores /> },
          { path: '/proyectos', element: <Proyectos /> },
          { path: '/proyectos/:id/:tab', element: <ProyectoDetalle /> },
          { path: '/propiedades', element: <Propiedades /> },
          { path: '/contratos-propiedad', element: <Contratos /> },
          { path: '/alquileres', element: <CobrosAlquiler /> },
          { path: '/publicaciones-sociales', element: <PublicacionesSociales /> },
          { path: '/tienda-online/secciones', element: <TiendaOnlineSecciones /> },
          { path: '/tienda-online/pedidos', element: <TiendaOnlinePedidos /> },
          { path: '/tienda-online/configuracion/:seccion', element: <TiendaOnlineConfiguracion /> },
          { path: '/nomina/empleados', element: <NominaEmpleados /> },
          { path: '/nomina/periodos', element: <NominaPeriodos /> },
          { path: '/nomina/retenciones', element: <NominaRetenciones /> },
          { path: '/puestos', element: <Puestos /> },
          { path: '/plantillas-horario', element: <PlantillasHorario /> },
          { path: '/feriados', element: <Feriados /> },
          { path: '/tipos-ausencia', element: <TiposAusencia /> },
          { path: '/asistencia', element: <Asistencia /> },
          { path: '/ausencias', element: <Ausencias /> },
          { path: '/horarios-empleado', element: <HorariosEmpleado /> },
          { path: '/pos', element: <Pos /> },
          { path: '/ia', element: <Ia /> },
          { path: '/notificaciones', element: <Notificaciones /> },
          { path: '/plantillas-notificacion', element: <PlantillasNotificacion /> },
          { path: '/formato-documentos', element: <FormatoDocumentos /> },
          { path: '/mensajes', element: <Mensajes /> },
          { path: '/categorias-cliente', element: <CategoriasCliente /> },
          { path: '/categorias-proveedor', element: <CategoriasProveedor /> },
          { path: '/leyes-fiscales', element: <LeyesFiscales /> },
          { path: '/tasas-cambio', element: <TasasCambio /> },
          { path: '/configuracion', element: <Configuracion /> },
          { path: '/reportes', element: <Reportes /> },
          { path: '/usuarios', element: <Usuarios /> },
          { path: '/roles-permisos', element: <RolesPermisos /> },
          { path: '/datos-empresa', element: <DatosEmpresa /> },
          { path: '/ncf', element: <Ncf /> },
          { path: '/consecutivos', element: <Consecutivos /> },
          { path: '/autorizaciones', element: <Autorizaciones /> },
          { path: '/pasarela-pago', element: <PasarelaPago /> },
          { path: '/parametros', element: <Parametros /> },
          { path: '/documentos', element: <Documentos /> },
          { path: '/webhooks', element: <Webhooks /> },
          { path: '/auditoria/:tab', element: <Auditoria /> },
          { path: '/crm/leads', element: <CrmLeads /> },
          { path: '/crm/pipeline', element: <CrmPipeline /> },
          { path: '/crm/etapas-pipeline', element: <CrmEtapasPipeline /> },
          { path: '/crm/dashboard', element: <CrmDashboard /> },
          { path: '/crm/metas-venta', element: <CrmMetasVenta /> },
          { path: '/whatsapp-config', element: <WhatsappConfig /> },
          { path: '/travel-config', element: <TravelConfig /> },
          { path: '/correo-config', element: <CorreoConfig /> },
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
