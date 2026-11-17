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
import { FacturacionVer } from './pages/FacturacionVer';
import { Cotizaciones } from './pages/Cotizaciones';
import { CotizacionNueva } from './pages/CotizacionNueva';
import { CotizacionEditar } from './pages/CotizacionEditar';
import { CotizacionVer } from './pages/CotizacionVer';
import { Remisiones } from './pages/Remisiones';
import { RemisionNueva } from './pages/RemisionNueva';
import { RemisionEditar } from './pages/RemisionEditar';
import { RemisionVer } from './pages/RemisionVer';
import { NotasCredito } from './pages/NotasCredito';
import { CuentasPorCobrar } from './pages/CuentasPorCobrar';
import { CuentaPorCobrarVer } from './pages/CuentaPorCobrarVer';
import { CuentasPorPagar } from './pages/CuentasPorPagar';
import { FacturasProveedor } from './pages/FacturasProveedor';
import { FacturaProveedorNueva } from './pages/FacturaProveedorNueva';
import { TerminosPago } from './pages/TerminosPago';
import { InventarioStock } from './pages/inventario/InventarioStock';
import { BodegaNueva } from './pages/inventario/BodegaNueva';
import { BodegaVer } from './pages/inventario/BodegaVer';
import { InventarioAjustes } from './pages/inventario/InventarioAjustes';
import { InventarioTransferencias } from './pages/inventario/InventarioTransferencias';
import { InventarioAjusteNuevo } from './pages/InventarioAjusteNuevo';
import { InventarioAjusteVer } from './pages/InventarioAjusteVer';
import { InventarioTransferenciaNueva } from './pages/InventarioTransferenciaNueva';
import { InventarioTransferenciaVer } from './pages/InventarioTransferenciaVer';
import { BancoNuevo } from './pages/BancoNuevo';
import { BancoVer } from './pages/BancoVer';
import { Conteos } from './pages/Conteos';
import { InventarioConteoNuevo } from './pages/InventarioConteoNuevo';
import { ConteoDetalle } from './pages/ConteoDetalle';
import { InventarioAlertas } from './pages/InventarioAlertas';
import { ConfiguracionInventario } from './pages/ConfiguracionInventario';
import { Sucursales } from './pages/Sucursales';
import { SucursalNueva } from './pages/SucursalNueva';
import { SucursalVer } from './pages/SucursalVer';
import { Compras } from './pages/Compras';
import { OrdenCompraNueva } from './pages/OrdenCompraNueva';
import { OrdenCompraVer } from './pages/OrdenCompraVer';
import { OrdenCompraRecibir } from './pages/OrdenCompraRecibir';
import { OrdenCompraDevolver } from './pages/OrdenCompraDevolver';
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
import { CatalogoCuentaNueva } from './pages/CatalogoCuentaNueva';
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
import { EmpleadoNuevo } from './pages/nomina/EmpleadoNuevo';
import { EmpleadoVer } from './pages/nomina/EmpleadoVer';
import { NominaPeriodos } from './pages/nomina/NominaPeriodos';
import { NominaRetenciones } from './pages/nomina/NominaRetenciones';
import { NominaReciboVer } from './pages/NominaReciboVer';
import { Puestos } from './pages/Puestos';
import { PlantillasHorario } from './pages/PlantillasHorario';
import { PlantillaHorarioDias } from './pages/PlantillaHorarioDias';
import { Feriados } from './pages/Feriados';
import { TiposAusencia } from './pages/TiposAusencia';
import { Asistencia } from './pages/Asistencia';
import { AsistenciaNueva } from './pages/AsistenciaNueva';
import { Ausencias } from './pages/Ausencias';
import { AusenciaNueva } from './pages/AusenciaNueva';
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
import { GastoMenorNuevo } from './pages/GastoMenorNuevo';
import { GastoMenorVer } from './pages/GastoMenorVer';
import { Proyectos } from './pages/Proyectos';
import { Propiedades } from './pages/Propiedades';
import { PropiedadVer } from './pages/inmobiliaria/PropiedadVer';
import { MisTareas } from './pages/MisTareas';
import { TareaPersonalVer } from './pages/TareaPersonalVer';
import { CategoriasIncentivo } from './pages/CategoriasIncentivo';
import { Soporte } from './pages/Soporte';
import { Auditoria } from './pages/Auditoria';
import { CrmLeads } from './pages/CrmLeads';
import { LeadNuevo } from './pages/crm/LeadNuevo';
import { LeadVer } from './pages/crm/LeadVer';
import { CrmPipeline } from './pages/CrmPipeline';
import { CrmEtapasPipeline } from './pages/CrmEtapasPipeline';
import { EtapaPipelineVer } from './pages/crm/EtapaPipelineVer';
import { OportunidadNueva } from './pages/crm/OportunidadNueva';
import { OportunidadVer } from './pages/crm/OportunidadVer';
import { OportunidadGenerarCotizacion } from './pages/crm/OportunidadGenerarCotizacion';
import { CrmDashboard } from './pages/CrmDashboard';
import { CrmMetasVenta } from './pages/CrmMetasVenta';
import { MetaVentaNueva } from './pages/crm/MetaVentaNueva';
import { TravelResumen } from './pages/travel/TravelResumen';
import { TravelReservasLista } from './pages/travel/TravelReservasLista';
import { TravelBuscarVuelo } from './pages/travel/TravelBuscarVuelo';
import { TravelBuscarHotel } from './pages/travel/TravelBuscarHotel';
import { TravelMarkup } from './pages/travel/TravelMarkup';
import { Contratos } from './pages/Contratos';
import { ContratoAdministrarAlquiler } from './pages/ContratoAdministrarAlquiler';
import { CobrosAlquiler } from './pages/CobrosAlquiler';
import { InmobiliariaPublicaLayout } from './pages/inmobiliaria/InmobiliariaPublicaLayout';
import { PropiedadesPublico } from './pages/inmobiliaria/PropiedadesPublico';
import { PropiedadPublicoDetalle } from './pages/inmobiliaria/PropiedadPublicoDetalle';
import { PropiedadesFavoritas } from './pages/inmobiliaria/PropiedadesFavoritas';
import { ProyectoDetalle } from './pages/ProyectoDetalle';
import { ProyectoNuevo } from './pages/proyectos/ProyectoNuevo';
import { ProyectoEditar } from './pages/proyectos/ProyectoEditar';
import { HitoNuevo } from './pages/proyectos/HitoNuevo';
import { HitoVer } from './pages/proyectos/HitoVer';
import { TareaNueva } from './pages/proyectos/TareaNueva';
import { TareaVer } from './pages/proyectos/TareaVer';
import { PublicacionesSociales } from './pages/PublicacionesSociales';
import { TiendaOnlineSecciones } from './pages/tienda-online/TiendaOnlineSecciones';
import { SeccionTiendaVer } from './pages/tienda-online/SeccionTiendaVer';
import { TiendaOnlinePedidos } from './pages/tienda-online/TiendaOnlinePedidos';
import { PedidoTiendaVer } from './pages/tienda-online/PedidoTiendaVer';
import { TiendaOnlineConfiguracion } from './pages/tienda-online/TiendaOnlineConfiguracion';
import { Usuarios } from './pages/Usuarios';
import { UsuarioNuevo } from './pages/UsuarioNuevo';
import { UsuarioVer } from './pages/UsuarioVer';
import { RolesPermisos } from './pages/RolesPermisos';
import { RolVer } from './pages/RolVer';
import { Configuracion } from './pages/Configuracion';
import { Reportes } from './pages/Reportes';
import { DatosEmpresa } from './pages/DatosEmpresa';
import { Ncf } from './pages/Ncf';
import { Consecutivos } from './pages/Consecutivos';
import { ConsecutivoVer } from './pages/ConsecutivoVer';
import { Autorizaciones } from './pages/Autorizaciones';
import { PasarelaPago } from './pages/PasarelaPago';
import { CategoriasCliente } from './pages/CategoriasCliente';
import { CategoriasProveedor } from './pages/CategoriasProveedor';
import { LeyesFiscales } from './pages/LeyesFiscales';
import { TasasCambio } from './pages/TasasCambio';
import { Parametros } from './pages/Parametros';
import { Documentos } from './pages/Documentos';
import { Webhooks } from './pages/Webhooks';
import { WebhookNuevo } from './pages/WebhookNuevo';
import { WebhookEntregas } from './pages/WebhookEntregas';
import { WhatsappConfig } from './pages/WhatsappConfig';
import { TravelConfig } from './pages/TravelConfig';
import { CorreoConfig } from './pages/CorreoConfig';
import { PlatformLogin } from './pages/PlatformLogin';
import { PlatformDashboard } from './pages/PlatformDashboard';
import { PlatformTenants } from './pages/PlatformTenants';
import { TenantNuevo } from './pages/plataforma/TenantNuevo';
import { TenantVer } from './pages/plataforma/TenantVer';
import { PlatformPlanes } from './pages/PlatformPlanes';
import { PlatformPlanVer } from './pages/PlatformPlanVer';
import { PlatformPlanModulos } from './pages/PlatformPlanModulos';
import { PlatformCupones } from './pages/PlatformCupones';
import { PlatformCuponVer } from './pages/PlatformCuponVer';
import { PlatformCuponAplicaciones } from './pages/PlatformCuponAplicaciones';
import { PlatformRoles } from './pages/PlatformRoles';
import { PlatformAdmins } from './pages/PlatformAdmins';
import { PlatformFacturas } from './pages/PlatformFacturas';
import { PlatformFacturaNueva } from './pages/PlatformFacturaNueva';
import { PlatformActividad } from './pages/PlatformActividad';
import { PlatformSoporte } from './pages/PlatformSoporte';
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
          { path: '/plataforma/tenants/nuevo', element: <TenantNuevo /> },
          { path: '/plataforma/tenants/:id', element: <TenantVer /> },
          { path: '/plataforma/planes', element: <PlatformPlanes /> },
          { path: '/plataforma/planes/nuevo', element: <PlatformPlanVer /> },
          { path: '/plataforma/planes/:id', element: <PlatformPlanVer /> },
          { path: '/plataforma/planes/:id/modulos', element: <PlatformPlanModulos /> },
          { path: '/plataforma/cupones', element: <PlatformCupones /> },
          { path: '/plataforma/cupones/nuevo', element: <PlatformCuponVer /> },
          { path: '/plataforma/cupones/:id', element: <PlatformCuponVer /> },
          { path: '/plataforma/cupones/:id/aplicaciones', element: <PlatformCuponAplicaciones /> },
          { path: '/plataforma/roles', element: <PlatformRoles /> },
          { path: '/plataforma/admins', element: <PlatformAdmins /> },
          { path: '/plataforma/facturas', element: <PlatformFacturas /> },
          { path: '/plataforma/facturas/nueva', element: <PlatformFacturaNueva /> },
          { path: '/plataforma/actividad', element: <PlatformActividad /> },
          { path: '/plataforma/soporte', element: <PlatformSoporte /> },
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
          { path: '/facturacion/:id', element: <FacturacionVer /> },
          { path: '/cotizaciones', element: <Cotizaciones /> },
          { path: '/cotizaciones/nueva', element: <CotizacionNueva /> },
          { path: '/cotizaciones/:id/editar', element: <CotizacionEditar /> },
          { path: '/cotizaciones/:id', element: <CotizacionVer /> },
          { path: '/remisiones', element: <Remisiones /> },
          { path: '/remisiones/nueva', element: <RemisionNueva /> },
          { path: '/remisiones/:id/editar', element: <RemisionEditar /> },
          { path: '/remisiones/:id', element: <RemisionVer /> },
          { path: '/notas-credito', element: <NotasCredito /> },
          { path: '/ofertas', element: <Ofertas /> },
          { path: '/bonos', element: <Bonos /> },
          { path: '/lealtad', element: <Lealtad /> },
          { path: '/cajas', element: <Cajas /> },
          { path: '/formas-pago', element: <FormasPago /> },
          { path: '/cuentas-por-cobrar', element: <CuentasPorCobrar /> },
          { path: '/cuentas-por-cobrar/:facturaId', element: <CuentaPorCobrarVer /> },
          { path: '/cuentas-por-pagar', element: <CuentasPorPagar /> },
          { path: '/facturas-proveedor', element: <FacturasProveedor /> },
          { path: '/facturas-proveedor/nueva', element: <FacturaProveedorNueva /> },
          { path: '/terminos-pago', element: <TerminosPago /> },
          { path: '/inventario/stock', element: <InventarioStock /> },
          { path: '/inventario/bodegas/nueva', element: <BodegaNueva /> },
          { path: '/inventario/bodegas/:id', element: <BodegaVer /> },
          { path: '/inventario/ajustes', element: <InventarioAjustes /> },
          { path: '/inventario/ajustes/nuevo', element: <InventarioAjusteNuevo /> },
          { path: '/inventario/ajustes/:id', element: <InventarioAjusteVer /> },
          { path: '/inventario/transferencias', element: <InventarioTransferencias /> },
          { path: '/inventario/transferencias/nuevo', element: <InventarioTransferenciaNueva /> },
          { path: '/inventario/transferencias/:id', element: <InventarioTransferenciaVer /> },
          { path: '/inventario/conteos', element: <Conteos /> },
          { path: '/inventario/conteos/nuevo', element: <InventarioConteoNuevo /> },
          { path: '/inventario/conteos/:id', element: <ConteoDetalle /> },
          { path: '/inventario/alertas', element: <InventarioAlertas /> },
          { path: '/inventario/configuracion', element: <ConfiguracionInventario /> },
          { path: '/sucursales', element: <Sucursales /> },
          { path: '/sucursales/nueva', element: <SucursalNueva /> },
          { path: '/sucursales/:id', element: <SucursalVer /> },
          { path: '/compras', element: <Compras /> },
          { path: '/compras/nueva', element: <OrdenCompraNueva /> },
          { path: '/compras/:id', element: <OrdenCompraVer /> },
          { path: '/compras/:id/recibir', element: <OrdenCompraRecibir /> },
          { path: '/compras/:id/devolver', element: <OrdenCompraDevolver /> },
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
          { path: '/mis-tareas/categorias-incentivo', element: <CategoriasIncentivo /> },
          { path: '/mis-tareas/:id', element: <TareaPersonalVer /> },
          { path: '/soporte', element: <Soporte /> },
          { path: '/travel/resumen', element: <TravelResumen /> },
          { path: '/travel/reservas', element: <TravelReservasLista /> },
          { path: '/travel/buscar-vuelo', element: <TravelBuscarVuelo /> },
          { path: '/travel/buscar-hotel', element: <TravelBuscarHotel /> },
          { path: '/travel/markup', element: <TravelMarkup /> },
          { path: '/contabilidad/cuentas', element: <ContabilidadCuentas /> },
          { path: '/contabilidad/cuentas/nueva', element: <CatalogoCuentaNueva /> },
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
          { path: '/bancos/nuevo', element: <BancoNuevo /> },
          { path: '/bancos/:id', element: <BancoVer /> },
          { path: '/gastos-menores', element: <GastosMenores /> },
          { path: '/gastos-menores/nuevo', element: <GastoMenorNuevo /> },
          { path: '/gastos-menores/:id', element: <GastoMenorVer /> },
          { path: '/proyectos', element: <Proyectos /> },
          { path: '/proyectos/nuevo', element: <ProyectoNuevo /> },
          { path: '/proyectos/:id/editar', element: <ProyectoEditar /> },
          { path: '/proyectos/:id/hitos/nuevo', element: <HitoNuevo /> },
          { path: '/proyectos/:id/hitos/:hitoId', element: <HitoVer /> },
          { path: '/proyectos/:id/tareas/nueva', element: <TareaNueva /> },
          { path: '/proyectos/:id/tareas/:tareaId', element: <TareaVer /> },
          { path: '/proyectos/:id/:tab', element: <ProyectoDetalle /> },
          { path: '/propiedades', element: <Propiedades /> },
          { path: '/propiedades/nuevo', element: <PropiedadVer /> },
          { path: '/propiedades/:id', element: <PropiedadVer /> },
          { path: '/contratos-propiedad', element: <Contratos /> },
          { path: '/contratos-propiedad/:id/administrar-alquiler', element: <ContratoAdministrarAlquiler /> },
          { path: '/alquileres', element: <CobrosAlquiler /> },
          { path: '/publicaciones-sociales', element: <PublicacionesSociales /> },
          { path: '/tienda-online/secciones', element: <TiendaOnlineSecciones /> },
          { path: '/tienda-online/secciones/nueva', element: <SeccionTiendaVer /> },
          { path: '/tienda-online/secciones/:id', element: <SeccionTiendaVer /> },
          { path: '/tienda-online/pedidos', element: <TiendaOnlinePedidos /> },
          { path: '/tienda-online/pedidos/:facturaId', element: <PedidoTiendaVer /> },
          { path: '/tienda-online/configuracion/:seccion', element: <TiendaOnlineConfiguracion /> },
          { path: '/nomina/empleados', element: <NominaEmpleados /> },
          { path: '/nomina/empleados/nuevo', element: <EmpleadoNuevo /> },
          { path: '/nomina/empleados/:id', element: <EmpleadoVer /> },
          { path: '/nomina/periodos', element: <NominaPeriodos /> },
          { path: '/nomina/periodos/:periodoId/recibos/:reciboId', element: <NominaReciboVer /> },
          { path: '/nomina/retenciones', element: <NominaRetenciones /> },
          { path: '/puestos', element: <Puestos /> },
          { path: '/plantillas-horario', element: <PlantillasHorario /> },
          { path: '/plantillas-horario/:id/dias', element: <PlantillaHorarioDias /> },
          { path: '/feriados', element: <Feriados /> },
          { path: '/tipos-ausencia', element: <TiposAusencia /> },
          { path: '/asistencia', element: <Asistencia /> },
          { path: '/asistencia/nueva', element: <AsistenciaNueva /> },
          { path: '/ausencias', element: <Ausencias /> },
          { path: '/ausencias/nueva', element: <AusenciaNueva /> },
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
          { path: '/usuarios/nuevo', element: <UsuarioNuevo /> },
          { path: '/usuarios/:id', element: <UsuarioVer /> },
          { path: '/roles-permisos', element: <RolesPermisos /> },
          { path: '/roles-permisos/nuevo', element: <RolVer /> },
          { path: '/roles-permisos/:id', element: <RolVer /> },
          { path: '/datos-empresa', element: <DatosEmpresa /> },
          { path: '/ncf', element: <Ncf /> },
          { path: '/consecutivos', element: <Consecutivos /> },
          { path: '/consecutivos/:tipo', element: <ConsecutivoVer /> },
          { path: '/autorizaciones', element: <Autorizaciones /> },
          { path: '/pasarela-pago', element: <PasarelaPago /> },
          { path: '/parametros', element: <Parametros /> },
          { path: '/documentos', element: <Documentos /> },
          { path: '/webhooks', element: <Webhooks /> },
          { path: '/webhooks/nuevo', element: <WebhookNuevo /> },
          { path: '/webhooks/:id/entregas', element: <WebhookEntregas /> },
          { path: '/auditoria/:tab', element: <Auditoria /> },
          { path: '/crm/leads', element: <CrmLeads /> },
          { path: '/crm/leads/nuevo', element: <LeadNuevo /> },
          { path: '/crm/leads/:id', element: <LeadVer /> },
          { path: '/crm/pipeline', element: <CrmPipeline /> },
          { path: '/crm/oportunidades/nueva', element: <OportunidadNueva /> },
          { path: '/crm/oportunidades/:id', element: <OportunidadVer /> },
          { path: '/crm/oportunidades/:id/generar-cotizacion', element: <OportunidadGenerarCotizacion /> },
          { path: '/crm/etapas-pipeline', element: <CrmEtapasPipeline /> },
          { path: '/crm/etapas-pipeline/nueva', element: <EtapaPipelineVer /> },
          { path: '/crm/etapas-pipeline/:id', element: <EtapaPipelineVer /> },
          { path: '/crm/dashboard', element: <CrmDashboard /> },
          { path: '/crm/metas-venta', element: <CrmMetasVenta /> },
          { path: '/crm/metas-venta/nueva', element: <MetaVentaNueva /> },
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
