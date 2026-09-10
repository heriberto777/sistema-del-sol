# Plugin: Inmobiliaria

Catálogo de propiedades (venta/alquiler) para agencias inmobiliarias —
integrado a Contactos/Empleados existentes, no un sistema aislado. Un
agente (`Empleado`) se asigna a cada propiedad.

**Implementación real**: `backend/src/inmobiliaria/` (mismo criterio que
`proyectos`/`ecommerce` — este directorio es solo el manifiesto que lee
`PluginLoaderService` al boot, no el código).

## Modelo 1 — agencia de venta/alquiler (entregado completo)

- **Fase 1**: modelo de datos `Propiedad` (tipo, operación, estado,
  precio+moneda, ubicación, specs, amenidades como `String[]`) +
  `ImagenPropiedad` (galería, hija sin `tenantId` propio — mismo patrón
  que `ImagenProducto`); CRUD administrativo completo (listar con
  filtros, crear, editar, eliminar).
- **Fase 2**: página pública por subdominio (`/inmobiliaria/:subdominio`,
  mismo criterio arquitectónico que la Tienda Online — sin cuenta de
  cliente) con listado+filtros y ficha de detalle.
- **Fase 3**: `ContratoPropiedad` (venta/alquiler) con comisión al agente
  calculada de forma autónoma (no reusa `ComisionVenta`, que está atada al
  flujo de Factura/POS) — cierra el negocio, transiciona la `Propiedad` a
  VENDIDA/ALQUILADA, y admite anular (reabre la propiedad) y marcar la
  comisión como pagada.
- **Fase 4**: comparador de hasta 4 propiedades, calculadora de hipoteca
  (cliente, sin backend), favoritos en `localStorage` (sin cuenta) y
  alertas de búsqueda guardada (`AlertaBusquedaPropiedad` + cron diario
  que avisa por email cuando aparecen coincidencias nuevas).
- Permisos opt-in: `inmobiliaria.propiedades.ver` / `.crear` / `.editar` /
  `.eliminar` y `inmobiliaria.contratos.ver` / `.crear` / `.anular` —
  Admin Total/Gerente los heredan automático, cualquier otro rol necesita
  que se lo asignen a mano desde Roles y Permisos.
- Activación por tenant: clave `inmobiliaria` en `MODULOS_BASE` — vía Plan
  o `TenantModuloOverride`, nunca la activa el propio tenant.

## Modelo 2 — administradora de alquileres (entregado completo)

- `Propiedad.propietarioId` (Cliente dueño del inmueble, distinto del
  `agenteId`) + `ContratoPropiedad.administracionActiva` /
  `porcentajeComisionAdministracion` / `proximoCobroAlquilerEn`.
- `CobroAlquiler`: un cobro mensual por contrato administrado, ciclo
  PENDIENTE → COBRADO → LIQUIDADO, con la comisión de administración de la
  agencia calculada como snapshot. `CobrosAlquilerCronService` (diario) los
  genera solo, sin intervención manual.
- Al marcar un cobro como COBRADO, el admin elige facturarlo (con NCF o
  e-CF, según la modalidad ya configurada del tenant — reusa
  `FacturacionService.crear()`, mismo patrón que `ProyectosService.facturarHito`)
  o dejarlo como registro interno sin comprobante.
- Permisos: `inmobiliaria.alquileres.ver` / `.gestionar`.

## Modelo 3 — preventa (entregado completo, reusa Proyectos)

- Sin sistema de hitos propio: `Propiedad.proyectoPreventaId` vincula la
  propiedad a un `Proyecto` (plugin Proyectos, `modoFacturacion:
  PRECIO_FIJO`) — cada pago del plan de preventa es un `HitoProyecto`,
  cargado y facturado 100% desde la pantalla ya existente `/proyectos/:id`
  (sin duplicar esa UI/lógica en Inmobiliaria).
- "Iniciar preventa" crea el Proyecto y pasa la propiedad a `RESERVADA`
  (sale del catálogo público); al terminar de pagarse, el cierre final usa
  el mismo "Cerrar negocio" de Fase 3 (`RESERVADA` ya es un estado
  cerrable) — sin máquina de estados nueva. "Desvincular preventa" reabre
  la propiedad sin borrar el Proyecto.
- Exige que el tenant tenga también el módulo `proyectos` activo — si no,
  rechaza con un mensaje explícito en vez de crear un Proyecto huérfano
  que el tenant nunca podría ver.
- Permiso: `inmobiliaria.preventas.crear` (ver/cargar hitos usa los
  permisos ya existentes de Proyectos, sin duplicado).

## Tests

- Unitarios (mockeados): `inmobiliaria.service.spec.ts`,
  `inmobiliaria-publica.service.spec.ts`,
  `alertas-busqueda-propiedad-cron.service.spec.ts`,
  `cobros-alquiler-cron.service.spec.ts`.
- e2e (`backend/test/inmobiliaria.e2e-spec.ts`, Postgres real, 30 casos):
  aislamiento entre tenants en los tres modelos —
  Propiedades/Contratos/catálogo público (Modelo 1), cobros y
  administración de alquiler (Modelo 2, incluyendo que el tenant B no
  pueda tocar el contrato/cobro de A), y preventa (Modelo 3, incluyendo
  que sin el módulo Proyectos activo no se puede iniciar una preventa —
  ni sobre la propia propiedad ni la ajena — y que el tenant B no pueda
  desvincular la preventa de A). Cubre los dos mecanismos de scoping
  (`TenantPrismaService` admin y `PrismaService` + tenantId resuelto a
  mano en el catálogo público) y los IDOR de
  `agenteId`/`clienteId`/`propietarioId` cruzados.

## Pendiente conocido

Ninguno — roadmap completo (Modelo 1, 2 y 3) con cobertura e2e de
aislamiento entre tenants en los tres.
