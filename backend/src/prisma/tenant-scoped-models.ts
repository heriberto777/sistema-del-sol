// Modelos que llevan tenantId y deben filtrarse/inyectarse automáticamente
// en cada operación de Prisma. Ver tenant-prisma.service.ts.
//
// NOTA: ReciboNomina y MovimientoCaja NO están acá a propósito — no tienen
// columna tenantId propia (son hijos de PeriodoNomina/TurnoCaja, igual que
// LineaFactura/Stock son hijos de sus padres) y agregarlos rompería en
// runtime (Prisma fallaría al intentar filtrar/inyectar una columna que no
// existe). Su aislamiento depende de que cualquier acceso a ellos pase
// primero por el id de su padre ya validado contra el tenant — ver
// EmpleadosRepository/PeriodosNominaRepository/PosRepository.
export const TENANT_SCOPED_MODELS = new Set([
  'TenantSettings',
  'Configuracion',
  'TenantModuloOverride',
  'User',
  'Role',
  'AuditLog',
  'NcfAsignado',
  'Factura',
  'Producto',
  'Bodega',
  'MovimientoInventario',
  'Proveedor',
  'OrdenCompra',
  'RecepcionCompra',
  'Cliente',
  'Webhook',
  'NotificacionPlantilla',
  'Notificacion',
  'Cotizacion',
  'Remision',
  'CuentaContable',
  'AsientoContable',
  'PeriodoContableCerrado',
  'Empleado',
  'PeriodoNomina',
  'TurnoCaja',
  'Pago',
  'DevolucionCompra',
  'CuentaBancaria',
  'GastoMenor',
  'FormaPago',
  'VentaAparcada',
  'Categoria',
  'ListaPrecio',
  'VarianteProducto',
  'Atributo',
  // `Oferta`/`Bono` quedaron afuera por descuido al implementarse (Fase 4b/
  // 4c) — sin esto, `listar()`/`buscarPorId()`/`actualizar()`/`eliminar()`
  // de ambos módulos no tenían NINGÚN filtro de tenant (bug real de
  // aislamiento, encontrado mientras se agregaba `Lote` para Fase 5b —
  // mismo patrón de columna `tenantId` propia que el resto de esta lista).
  'Oferta',
  'Bono',
  'Lote',
  'HorarioEmpleado',
  'RegistroAsistencia',
  'Ausencia',
  'Sucursal',
  'CategoriaCliente',
  'Feriado',
  'Puesto',
  'LeyFiscal',
]);
