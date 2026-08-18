# Arquitectura

## Multi-tenancy: single DB + tenantId + RLS

Se eligió **una sola base de datos PostgreSQL**, con `tenantId` como
columna en cada tabla de negocio, en vez de schema-por-tenant o
DB-por-tenant. A la escala objetivo (~50 tenants año 1, con vista a
~500), schema/DB-por-tenant hace que cada migración de Prisma haya que
correrla N veces y satura el pool de conexiones; single DB con un único
pool y una única migración escala mejor operativamente.

El aislamiento tiene dos capas:

1. **Aplicación** (capa principal): `TenantPrismaService`
   (`backend/src/prisma/tenant-prisma.service.ts`) es un provider
   *request-scoped* que envuelve el cliente de Prisma con una
   [Client Extension](https://www.prisma.io/docs/orm/prisma-client/client-extensions)
   que inyecta automáticamente `tenantId` en el `where` de toda lectura/
   escritura y en el `data` de toda creación, para los modelos listados
   en `TENANT_SCOPED_MODELS`. Los repositorios de cada módulo usan
   `tenantPrisma.client`, nunca el `PrismaService` singleton directamente
   (salvo en listeners de eventos fuera de contexto de request — ver
   Notificaciones/Webhooks abajo).

   **Cuidado con las tablas "hijas" sin `tenantId` propio** (`stock`,
   `precios`, `linea_factura`, etc. — ver DATABASE.md): la inyección
   automática solo protege cuando se consulta la tabla PADRE (que sí
   tiene `tenantId`). Si un endpoint recibe un id de la tabla padre desde
   el cliente y consulta la tabla hija directamente con ese id
   (`stock.findMany({where:{bodegaId}})`), **no hay ningún filtro
   automático** — fue exactamente el bug real encontrado en
   `GET /inventario/stock/:bodegaId` y en todo `PreciosService`: cualquier
   `bodegaId`/`productoId` de otro tenant, adivinado o filtrado, permitía
   leer y corromper su stock/precios. La corrección (`InventarioService.
   validarPertenencia`, `PreciosService.*`) resuelve primero el padre
   (`Producto`/`Bodega`, sí tenant-scoped) vía `TenantPrismaService` antes
   de tocar la tabla hija — si el padre no pertenece al tenant, lanza 404
   antes de llegar a la tabla hija. Cualquier módulo nuevo que reciba un
   id de una tabla padre tenant-scoped para operar sobre una tabla hija
   sin `tenantId` propio debe seguir este mismo patrón.
2. **Base de datos** (defensa en profundidad — implementada y verificada):
   `prisma/sql/enable-rls.sql` activa Row-Level Security en Postgres
   (`ENABLE` + `FORCE`) para las tablas tenant-scoped, con una policy que
   compara `"tenantId"` contra `current_setting('app.tenant_id', true)`.
   Esto protege de verdad porque, a diferencia del rol de migraciones
   (`sol`/`POSTGRES_USER`, superusuario, ignora RLS por completo), el
   tráfico HTTP normal corre con un rol restringido nuevo (`sol_app`,
   `APP_DB_USER`/`APP_DATABASE_URL`) sin privilegios de superusuario ni
   `BYPASSRLS` — creado con `pnpm --filter ./backend db:app-role` (una
   vez) y las policies aplicadas con `db:rls` (después de cada
   migración).

   `AppPrismaService` (`backend/src/prisma/app-prisma.service.ts`) es el
   singleton conectado como `sol_app` — un `PrismaClient` nuevo, no el
   `PrismaService` de siempre, para no agotar el pool de conexiones
   abriendo una conexión nueva por request. `TenantPrismaService` lo
   extiende por request (barato, no abre conexión) y, antes de cada
   operación, aplica `SELECT set_config('app.tenant_id', ...)` dentro de
   una transacción — o bien la que ya esté abierta (`$transaction`,
   interceptado con un `Proxy` porque Prisma no permite overridearlo vía
   extensión), o bien una transacción de una sola operación abierta para
   ese propósito si la llamada es suelta. Un `AsyncLocalStorage` marca
   "esta transacción ya tiene SET LOCAL aplicado" para no volver a
   envolver ni a re-setear innecesariamente dentro de un mismo `tx`.

   **Ojo con las tablas "hijas" también acá**: la wrapping de SET LOCAL
   no se puede limitar a `TENANT_SCOPED_MODELS` (eso solo decide si se
   inyecta `tenantId` en el `where`/`data`) — un modelo hijo sin
   `tenantId` propio (`LineaAsiento`, `LineaFactura`, `Stock`, etc.)
   puede filtrar/incluir una relación hacia un padre con RLS forzado
   (ej. `lineaAsiento.findMany({ where: { asiento: { fecha: {...} } } })`
   hace un `JOIN` contra `asientos_contables`); sin SET LOCAL en esa
   misma conexión, ese `JOIN` queda filtrado por la policy y devuelve
   cero filas aunque los datos sí pertenezcan al tenant — bug real
   encontrado en `CierrePeriodoService.cerrarPeriodo` al activar RLS
   (`lineasEnRango` no traía ninguna línea). Por eso el SET LOCAL se
   aplica a **toda** operación que pase por `TenantPrismaService`, no
   solo a los modelos tenant-scoped.

   También hay que threadear el `tx` explícitamente en cualquier helper
   invocado desde dentro de una transacción ya abierta — antes de RLS,
   `InventarioService.validarPertenencia` llamaba `this.db.producto...`
   (el cliente top-level) incluso cuando la invocaba
   `verificarYDescontarStockEnTx(tx, ...)`; sin RLS eso era inofensivo
   (cada conexión aplicaba el mismo filtro de `tenantId` en el `where`),
   pero con RLS esa consulta cae en una conexión sin `app.tenant_id`
   seteado y la policy la bloquea (0 filas, 404 "no encontrado") aunque
   el producto sí exista. Se corrigió agregando variantes `*EnTx`
   (`ProductosRepository.buscarPorIdEnTx`,
   `InventarioRepository.buscarBodegaPorIdEnTx`) y pasando el `tx` desde
   `validarPertenencia`.

   **Alcance de esta capa (decisión deliberada)**: RLS solo cubre el
   tráfico que pasa por `TenantPrismaService` (todo el HTTP normal). Los
   listeners de eventos (`ContabilidadEventosService`,
   `NotificacionesService`, `WebhooksService`) y el cron de
   `RecordatoriosService` (que además consulta **todos los tenants a la
   vez**, sin `tenantId` en el `WHERE`) siguen usando el `PrismaService`
   de siempre (rol `sol`, sin RLS) — ya filtran correctamente por
   `tenantId` en código y no procesan input de un atacante directamente,
   así que el riesgo que RLS mitiga (un bug futuro en un endpoint) no
   aplica ahí de la misma forma. Extenderles RLS requeriría reescribir
   `RecordatoriosService` para iterar tenant por tenant, fuera de
   alcance de esta pasada.

`TenantMiddleware` decodifica (sin verificar) el JWT lo antes posible en
el ciclo del request solo para tener `tenantId` disponible en logs/rate
limiting; la seguridad real la hacen `JwtAuthGuard` (verifica firma) y
`TenantPrismaService` (aísla los datos).

## RBAC

Nivel "medio": roles fijos semnbrados por tenant (Admin Total, Gerente,
Vendedor, Almacenero, Contador, Auditor — ver `prisma/seed.ts`), cada uno
con un conjunto de permisos (`facturacion.crear`, `inventario.ajustar`,
etc.) vía la tabla `role_permissions`. Los controllers declaran los
permisos requeridos con `@Permissions('facturacion.crear')` y
`PermissionsGuard` los valida contra los permisos que el JWT trae
aplanados desde el login (`AuthService.login`).

**Permisos en el frontend** (`frontend/src/contexts/AuthContext.tsx`):
la respuesta de `POST /auth/login` incluye `usuario.permisos` (el mismo
array aplanado que ya se calculaba para el JWT, ahora también expuesto
en el cuerpo de la respuesta) — el frontend lo guarda junto al resto de
`usuario` y expone `tienePermiso(clave)` vía `useAuth()`. Se usa para:

- Filtrar el `Sidebar` (nunca se muestra un enlace a una sección que el
  usuario no puede usar).
- `<RequierePermiso permiso="...">` (`components/organisms/
  RequierePermiso/`) envuelve el contenido de cada página y muestra un
  aviso en vez de disparar queries que el backend va a rechazar con 403.
- Botones de acciones mutables (crear/editar/anular/desactivar) se
  ocultan individualmente cuando el permiso `.crear`/`.editar` difiere
  del `.ver` que ya gatilló la página (p. ej. `EmitirNotaForm` requiere
  `facturacion.crear`, no solo `facturacion.ver`).

**Esto es 100% UX, no seguridad**: la aplicación real del permiso sigue
siendo enteramente responsabilidad de `PermissionsGuard` en el backend.
Un usuario que edite el JS del navegador o llame a la API directo sigue
bloqueado igual que siempre — ocultar el botón solo evita que alguien
autorizado normal se tope con un 403 innecesario, y le muestra de
entrada solo lo que puede usar.

## Concurrencia y atomicidad en flujos multi-paso

Varios flujos que tocan más de una tabla (o más de una fila) tenían el
mismo patrón de bug: cada paso confirmaba por su cuenta, así que un
fallo a mitad de camino dejaba los pasos anteriores YA aplicados sin
que el paso que falló se completara nunca — inconsistencia real, no
solo teórica (se encontró corriendo los e2e, no por inspección).

- **NCF duplicado bajo concurrencia** (`FacturacionRepository.
  siguienteNcf`): calcular `secuenciaActual + 1` en JS a partir de un
  valor leído y escribirlo de vuelta permitía que dos facturas
  concurrentes leyeran el mismo valor y terminaran con el mismo NCF —
  violación real de la norma DGII de unicidad/secuencialidad. Se
  corrigió usando `{ increment: 1 }`, que Postgres ejecuta como
  `UPDATE ... SET x = x + 1` relativo al valor de la fila en ese
  momento (bajo su lock de fila), no al valor leído antes — dos
  transacciones concurrentes se serializan en ese `UPDATE` y cada una
  incrementa desde el valor ya actualizado por la anterior.
- **Correlativo de asiento contable perdido silenciosamente**
  (`AsientosContablesRepository.crear`/`crearGlobal`): el mismo patrón
  de "leer MAX, sumar 1 en JS" sobre `AsientoContable.numero` permitía
  que dos asientos concurrentes (p. ej. dos facturas creadas a la vez,
  cada una disparando su propio listener fire-and-forget) calcularan el
  mismo número; el `@@unique([tenantId, numero])` evitaba el duplicado,
  pero antes de este fix la colisión (P2002) se propagaba sin
  reintentar — uno de los dos asientos simplemente no se creaba, con el
  error solo logueado. Se corrigió con un reintento acotado
  (`conReintentoDeNumero`, hasta 5 intentos) que recalcula el MAX en
  cada intento — seguro porque, a diferencia del NCF, este número es
  solo una referencia interna sin continuidad legal estricta.
- **`FacturacionService.crear()`/`.anular()` no eran atómicos**: el
  descuento/reintegro de stock, el consumo de NCF y la creación/cambio
  de estado de la factura corrían como llamadas sueltas, cada una con
  su propia transacción (o ninguna). Un fallo a mitad de camino (p. ej.
  la línea 2 de 3 sin stock suficiente) dejaba el stock de las líneas
  anteriores ya descontado sin ninguna factura que lo justifique. Se
  corrigió envolviendo los tres pasos en una sola transacción
  (`tenantPrisma.client.$transaction`), con variantes `*EnTx` de los
  métodos de `InventarioService`/`FacturacionRepository` que reciben el
  `tx` en vez de abrir el suyo propio. Los métodos originales
  (`verificarYDescontarStock`, `entradaStock`, `siguienteNcf`,
  `crearFactura`, `anular`) siguen existiendo sin cambios para quien no
  necesite esta atomicidad cruzada (siguen abriendo su propia
  transacción internamente).
- **`InventarioService.transferirStock()` no era atómica**: restar en
  la bodega origen y sumar en la destino eran dos llamadas
  independientes; si la segunda fallaba, el producto quedaba
  descontado del origen sin acreditarse en ningún lado (inventario
  perdido de verdad). Se corrigió con `InventarioRepository.transferir`,
  que hace ambos movimientos en una sola transacción.
- **`ComprasService.recibir()` no era atómica**: crear la recepción,
  actualizar `cantidadRecibida` por línea, mover stock, y actualizar el
  estado de la orden eran pasos sueltos — mismo problema. Se corrigió
  igual, con el `tx` compartido entre `ComprasRepository` (que ahora
  recibe `tx` explícito en `crearRecepcion`/`actualizarCantidadRecibida`/
  `actualizarEstado`/`buscarPorIdEnTx`, ya que estos métodos SOLO se
  usan dentro de `recibir()`) e `InventarioService.entradaStockEnTx`.

**Fuera de alcance deliberadamente**: la validación de "stock nunca
negativo" (`verificarYDescontarStock`) sigue teniendo una ventana TOCTOU
bajo concurrencia (lee el disponible, decide, y recién después
descuenta) — dos ventas concurrentes sobre el mismo producto/bodega
podrían ambas pasar la validación. Cerrar esa ventana del todo
requeriría un `UPDATE` condicional atómico (`WHERE cantidadActual -
cantidadReservada >= cantidad`) en vez de leer-y-decidir, que no se
implementó en esta pasada — el fix de arriba soluciona la atomicidad
del flujo completo (todo-o-nada ante un fallo), no esta carrera
específica de lectura-antes-de-escribir.

## Notas de crédito/débito: efecto en inventario y anulación

Una nota de crédito (`tipoFactura: NOTA_CREDITO`) devuelve mercancía —
`FacturacionService.crear()` la trata al revés de una venta normal:
llama `entradaStock` (no `verificarYDescontarStock`) y guarda
`subtotal`/`itbis`/`total` **en negativo**, para que sumar todas las
facturas de un rango (dashboard, reportes) dé directamente el neto
correcto sin que cada consulta necesite conocer el `tipoFactura`. Una
nota de débito (`NOTA_DEBITO`) es un ajuste monetario sin contrapartida
física — no toca inventario en absoluto.

`anular()` reversa el efecto de inventario de la factura que anula
(devuelve stock si era una venta normal, lo retira de nuevo si era una
nota de crédito), y es idempotente por diseño: anular una factura ya
`ANULADA` lanza 400. El punto delicado es **anular una venta que ya tiene
notas de crédito parciales**: `Factura.bodegaId` (agregado para esto — no
existía antes) permite saber a qué bodega reintegrar, y
`buscarPorId` trae `notasRelacionadas` (las notas de crédito `EMITIDA`
que la referencian) para calcular cuánto de cada línea **ya se devolvió**
antes de reintegrar — sin esto, anular duplicaría la devolución de lo que
una nota parcial ya había devuelto (bug real encontrado probando a mano
contra Docker, no solo con mocks: unit tests con repos falsos no lo
detectaron porque el mock no modelaba la relación entre notas y su
factura origen).

## Cotizaciones y Remisiones

Documentos sin efecto fiscal que preceden a una factura, cada uno en su
propio módulo (`backend/src/cotizaciones/`, `backend/src/remisiones/`),
pero ambos reutilizan `FacturacionService.crear()` para el paso final de
"convertir en factura" — ninguno duplica la lógica de NCF/ITBIS/descuento
de stock.

- **Cotización**: `BORRADOR → ENVIADA → ACEPTADA/RECHAZADA`. "Vencida" es
  un estado **derivado**, no persistido: si `fechaVigenciaHasta` ya pasó y
  el estado real sigue en BORRADOR/ENVIADA, el servicio lo muestra como
  `VENCIDA` en la respuesta sin necesidad de un cron que actualice la fila.
  Al convertir, copia sus líneas (con el `precioUnitario` que ya tenía) a
  una factura nueva.
- **Remisión**: `BORRADOR → ENTREGADA → FACTURADA`. **Simplificación
  deliberada de v1**: a diferencia de una remisión real (que mueve
  inventario físico al entregarse, antes de facturar), esta no toca stock
  por sí sola — el descuento ocurre recién al convertirla en factura,
  igual que una venta normal. Modelar la entrega física por separado de
  la facturación es una mejora futura si el negocio la necesita; evita
  duplicar la lógica de movimiento de stock en dos lugares mientras tanto.
  Al convertir, las líneas van sin `precioUnitario` (la remisión no
  guarda precio) — se resuelve al precio vigente del producto en ese
  momento, igual que una factura normal sin precio explícito.

Ambos quedan con `facturaId` (único) apuntando a la factura resultante
una vez convertidos, y no se pueden operar ni reconvertir después de eso
(`validarQueSigaAbierta` en cada servicio).

**Nota de mantenimiento**: agregar un permiso nuevo a `PERMISOS_BASE`
(`backend/src/tenants/roles-base.ts`) solo afecta tenants creados
**después** de ese cambio — los tenants ya provisionados no reciben el
permiso nuevo automáticamente en sus roles existentes (se descubrió al
agregar `cotizaciones.*`/`remisiones.*`: el tenant demo no podía usar los
endpoints nuevos hasta otorgárselos a mano). No hay todavía un mecanismo
de "backfill" de permisos para tenants existentes — si se necesita,
otorgarlos manualmente vía `rolePermission.create` o construir una
migración de datos para ese propósito.

## Reportes fiscales DGII (606/607/608)

`backend/src/reportes-fiscales/` genera los tres formatos que exige la
Norma General 07-18: **607** (ventas, desde `facturas` EMITIDA), **608**
(comprobantes anulados, desde `facturas` ANULADA) y **606** (compras,
desde `recepcion_compra` — se usa la recepción, no la orden, porque es
ahí donde vive `facturaProveedorNumero`, el número del comprobante del
proveedor). Cada uno tiene una vista JSON (`GET .../607`) para revisar en
pantalla y una exportación a texto (`GET .../607/exportar`, `|` como
delimitador, fechas en `AAAAMMDD`).

**Limitación importante, y por qué existe**: el layout **exacto** de
estos archivos (orden de columnas, códigos de tipo de ingreso/bien/
anulación) no se pudo verificar byte a byte — los instructivos oficiales
de la DGII son PDFs no extraíbles como texto (se investigó a fondo:
múltiples fuentes secundarias corroboran QUÉ datos van en cada formato,
pero no el layout binario exacto, y la DGII solo valida eso de verdad con
su herramienta de pre-validación de la Oficina Virtual, a la que no hay
acceso aquí). Es exactamente el mismo tipo de bloqueo que ya existía para
la firma digital de e-CF: se implementa la lógica de datos (que sí se
puede verificar contra la propia base) y se documenta la brecha en vez
de fingir una certeza que no existe. **Antes de remitir esto a la DGII en
producción, hay que validarlo con esa herramienta oficial.** El
frontend (`Reportes` → pestaña "DGII") muestra esta advertencia también.

Por la misma razón de datos disponibles, **606 calcula el ITBIS por
línea** usando `producto.porcentajeItbis` (igual que facturación) en vez
de leerlo de un campo propio — `linea_recepcion` no guarda ITBIS todavía,
así que se deriva del producto en el momento de generar el reporte.

`itbis-resumen` no es un formato DGII per se — es el neto (607 - 606) que
alimenta la declaración de ITBIS; se agregó porque es un subproducto
directo de tener ambos formatos ya calculados.

**606 también incluye gastos menores** (ver sección de abajo): las filas
de `comprasRecibidasEnRango` (compras formales, con RNC de proveedor) y
`gastosMenoresEnRango` (mercado informal, `rncProveedor: ''`) se
mezclan y ordenan por fecha en `formato606()`.

**606 NO incluye todavía las columnas de ITBIS/ISR retenido** que sí
contempla el layout oficial: la retención (ver "Retenciones a
proveedores" más abajo) se registra por fecha de **pago** (`Pago`), no
por fecha de recepción/factura (`RecepcionCompra`, que es la fuente de
606) — mezclarlas correctamente exigiría relacionar cada pago con la(s)
línea(s) de recepción que salda, algo que el schema no modela hoy. Se
optó por un reporte separado (`retenciones-proveedores`, ver abajo) en
vez de forzar un cruce incorrecto entre dos períodos distintos.

## Retenciones a proveedores (ISR/ITBIS)

Cuando el tenant le paga a un proveedor por servicios, la DGII exige
retener parte del pago (ISR, Art. 309 — honorarios/alquileres/servicios
en general prestados por Personas Físicas; ITBIS, Art. 349, en ciertas
categorías de servicios) y remitirlo aparte a la DGII en vez de pagarlo
al proveedor. El disparador es **manual**: una casilla al registrar el
pago de una orden de compra (`PagosService.registrarPagoOrdenCompra`,
campos `retencionIsr`/`retencionItbis` en `Pago`) — el sistema no intenta
inferir automáticamente si un proveedor es persona física ni qué
servicio califica, eso lo decide quien registra el pago.

El monto bruto (`Pago.monto`) sigue siendo el que salda `OrdenCompra.total`
sin cambios; la retención solo afecta cuánto sale de Caja y a qué cuentas
se acredita (`AsientosContablesService.generarDesdePagoOrdenCompra`):
débito Cuentas por Pagar por el bruto, crédito Caja y Bancos por el neto,
crédito "ISR Retenido a Terceros por Pagar" (`2040`) y/o "ITBIS Retenido a
Terceros por Pagar" (`2050`) por lo retenido — cuentas nuevas en
`CUENTAS_BASE`, distintas de `2030 TSS e ISR por Pagar` (esa es de
nómina/empleados, declaración distinta).

La tasa de referencia (`CONFIGURACIONES_BASE.RETENCION_ISR_TASA`/
`RETENCION_ITBIS_TASA`, editable en Admin → Configuración general, mismo
mecanismo que `ITBIS_GENERAL`) es puramente informativa — igual que el
resto de `CONFIGURACIONES_BASE`, no se lee en ningún cálculo del backend,
ya que el disparador es manual y el monto retenido lo decide quien
registra el pago. **Default 15% de ISR**: hay referencias (no verificadas
contra una fuente oficial en tiempo real) de que la tasa subió de 10% a
15% para pagos del Art. 309 desde julio 2026 — confirmar antes de
producción, mismo tipo de brecha ya documentada para las tasas de TSS/ISR
de Nómina.

`ReportesFiscalesService.retencionesProveedores()` (endpoint
`GET /reportes-fiscales/retenciones-proveedores`) lista los pagos con
retención en un rango — junto con `retencionesNomina()` cubre las dos
secciones de la declaración mensual de retenciones que pide la DGII
(formulario IR-17); no es el layout oficial del formulario, son los
montos reales.

## Gastos menores y Bancos

Dos flujos coexisten a propósito y no se deben confundir:

- **`crearGasto`** (dentro de Contabilidad, `AsientosContablesService`):
  un asiento manual de 2 líneas (débito a una cuenta de gasto, crédito a
  una cuenta genérica), sin NCF, para quien solo necesita registrar un
  movimiento contable rápido.
- **`backend/src/gastos-menores/`** (`GastoMenorService.crear`): un flujo
  completo pensado para compras en el mercado informal — múltiples
  líneas (cada una con su propia cuenta de gasto, ITBIS % y cantidad),
  un **NCF autoasignado tipo `B11`** (o `E43` si el tenant está en
  modalidad e-CF, mismo campo `Tenant.modalidadFacturacion` de
  facturación) obtenido con el mismo mecanismo atómico
  (`NcfAsignado` + `{ increment: 1 }`) que usa `FacturacionService`, y
  una **cuenta bancaria** (`backend/src/bancos/`, modelo
  `CuentaBancaria`) como origen del dinero en vez de una cuenta contable
  cruda.

`CuentaBancaria` es deliberadamente una capa fina de UX, no un módulo de
conciliación bancaria (eso sigue fuera de alcance, ver más abajo): no
guarda saldo propio, no importa extractos ni concilia transacciones — el
saldo real vive en el libro mayor de la `cuentaContable` que tiene
vinculada (`GET /contabilidad/libro-mayor/:cuentaId`, ya existente).

Al crear un gasto menor, `GastoMenorService` emite
`EVENTOS.GASTO_MENOR_CREADO` (mismo patrón fire-and-forget del Event
Bus) y `ContabilidadEventosService.alCrearGastoMenor` genera el asiento
(`AsientosContablesService.generarDesdeGastoMenor`): un débito por cada
línea a su cuenta de gasto, un débito a "ITBIS Adelantado" por el ITBIS
total (si > 0), y un crédito a la cuenta contable vinculada a la cuenta
bancaria por el total — `origen: 'GASTO_MENOR'`.

## Listados: búsqueda y paginación

Todos los endpoints de listado que pueden crecer sin límite (facturas,
clientes, productos, proveedores, compras, usuarios, notificaciones,
audit-log de plataforma) comparten el mismo contrato: `ListadoQueryDto`
(`backend/src/common/dto/listado-query.dto.ts`, query params `pagina`,
`tamanoPagina`, `busqueda`) de entrada, y `PaginaResultado<T>`
(`backend/src/common/types/pagina-resultado.ts`, `{ datos, total, pagina,
tamanoPagina }`) de salida — nunca un array plano, precisamente para que
el frontend pueda pintar controles de paginación reales con el total
verdadero, no solo el tamaño de la página actual. `paginar()` en el mismo
archivo centraliza el cálculo de `skip`/`take` con los defaults
(`pagina=1`, `tamanoPagina=20`).

Cada repositorio implementa su propio `busqueda` como un `OR` de
`contains`/`insensitive` sobre los campos de texto relevantes de ese
modelo (nombre, email, NCF, número de orden, etc.) — no hay un mecanismo
de búsqueda genérico entre modelos. Un módulo nuevo que liste algo que
pueda crecer debería seguir este mismo patrón en vez de devolver
`findMany()` sin paginar.

Nota: `productos` y `proveedores` ya tienen búsqueda/paginación en el
backend pero **no tienen página propia en el frontend todavía** (nunca la
tuvieron en este scaffold) — no es una regresión, es trabajo pendiente
si se decide construir esas pantallas de administración.

## Plugin system

Instalación **manual** (git/deploy): un plugin es un paquete del
workspace bajo `plugins/<nombre>/` con un `plugin.json` (manifiesto) y su
propio módulo NestJS, que se importa a mano en `backend/src/app.module.ts`
y se compila junto al resto del backend (un solo proceso, no
microservicios). `PluginLoaderService` escanea `plugins/*/plugin.json` al
boot solo para loguear qué hay disponible en el código desplegado.

La **activación por tenant** usa el mismo mecanismo de Planes/módulos
descrito abajo (ver "Planes y módulos activables por tenant") — un
plugin como Inmobiliaria es, para efectos de activación, un módulo más
del catálogo (`@RequiereModulo('inmobiliaria')`), no un sistema aparte.
Así un mismo release del backend sirve a tenants con distintos
plugins/módulos activos, sin recompilar ni redeployar por cliente.

Roadmap: Inmobiliaria → Clínica → Casa de Cambio. Ver
`plugins/inmobiliaria/README.md` para el patrón a seguir en cada plugin
nuevo.

## Planes y módulos activables por tenant

Desde la plataforma (super admin), qué módulos ve/puede usar cada tenant
se decide con dos capas:

1. **`Plan`** (`planes`): catálogo global (no por tenant) de "paquetes" —
   cada uno con un set de `Modulo` incluidos vía `PlanModulo`. Un tenant
   tiene a lo sumo un plan (`Tenant.planId`). Los planes por defecto
   (Básico/Profesional/Premium) viven como código en
   `backend/src/tenants/modulos-base.ts` (`PLANES_BASE`) y se siembran
   una sola vez por entorno con `pnpm --filter ./backend planes:seed`
   (catálogo de planes, NO por tenant — a diferencia de `PERMISOS_BASE`/
   `CUENTAS_BASE`, que se siembran en cada `crearConProvisioning`).
2. **`TenantModuloOverride`** (`tenant_modulo_overrides`, sí tenant-scoped):
   excepción puntual que gana sobre el plan en cualquier dirección —
   `activo:true` fuerza encendido aunque el plan no lo incluya (upsell de
   un módulo suelto sin cambiar de plan entero), `activo:false` fuerza
   apagado aunque el plan sí lo incluya.

La regla de resolución (override manda; si no hay, decide el plan; sin
plan asignado, deniega) vive en un solo lugar,
`backend/src/planes/resolver-modulos-activos.ts` (funciones puras, no un
servicio inyectable, justo para que no puedan divergir entre quien la
usa): `ModuloActivoGuard` (`backend/src/common/guards/modulo-activo.guard.ts`,
decorator `@RequiereModulo('clave')`) la aplica por request, y
`AuthService.login` la usa para mandar `usuario.modulosActivos` al
frontend (mismo criterio que `usuario.permisos`: solo UX para ocultar
sidebar, la aplicación real es 100% el guard).

`ModuloActivoGuard` está registrado **globalmente** vía `APP_GUARD` en
`app.module.ts` (a diferencia del `PluginActiveGuard` que reemplaza, que
nunca llegó a conectarse a ningún controller ni a `APP_GUARD` — quedó
código muerto cubierto solo por su propio test unitario). Un controller
sin `@RequiereModulo` no se ve afectado (no-op); un request sin
`request.user` (rutas públicas) tampoco.

**Contabilidad, Contactos, Reportes, Notificaciones y Admin quedan
siempre activos, sin `@RequiereModulo` y sin poder togglearse** — decisión
explícita: Contabilidad genera asientos automáticos consumidos por
Bancos/Gastos Menores (apagarla dejaría huecos en el libro si se
reactiva después) y los otros cuatro son plomería compartida entre
varios módulos de negocio (ej. Contactos lo usan Facturación y Compras
por igual).

Cada `Plan` tiene también `precio` (`Decimal(12,2)`, default `0`) y
`cicloFacturacion` (enum `MENSUAL`/`ANUAL`, default `MENSUAL`) — precio
de lista editable desde `/plataforma/planes`
(`PATCH /platform/planes/:id`). El precio de lista es la base de la
suscripción/facturación de plataforma (ver más abajo); un descuento
puntual se registra en la factura, nunca en el `Plan`.

## Suscripción y facturación de plataforma

Lo que la plataforma le cobra a cada tenant por el servicio — no
confundir con `Factura` (lo que un tenant le cobra a SUS clientes).
Tres modelos nuevos en `backend/prisma/schema.prisma`, deliberadamente
**fuera de `TENANT_SCOPED_MODELS`/RLS** (misma categoría que
`Modulo`/`Plan`/`PlanModulo`): solo se acceden desde controllers de
plataforma vía `PrismaService` raw.

- **`Suscripcion`** (`tenantId` único — una por tenant): `planId`,
  `estado` (`ACTIVA`/`CANCELADA`, cancelar pausa la generación
  automática sin tocar `Tenant.estado` — son ejes independientes),
  `fechaProximoCorte`, `feeMoraPct` (default 5, editable por tenant).
  Creada automáticamente en `TenantsRepository.crearConProvisioning`
  (`fechaProximoCorte: new Date()` — la primera factura sale en el
  próximo tick del cron, sin período de gracia). Tenants creados antes
  de esta feature (ej. "demo") no la tienen — se backfillean con
  `pnpm --filter ./backend suscripciones:backfill`. Si `TenantsService.
  actualizar` cambia el `planId` del tenant, también actualiza el de su
  `Suscripcion` (la próxima factura cobra el precio del plan nuevo).
- **`FacturaPlataforma`**: `monto`/`descuento`/`montoMora`/`total`
  (`Decimal(14,2)`), `estado` (`PENDIENTE`/`PAGADA`/`VENCIDA`/
  `ANULADA`), `fechaEmision`/`fechaVencimiento` (iguales al generarse —
  sin período de gracia; el admin puede moverla con `PATCH` si hace
  falta). Editable (`FacturasPlataformaService.actualizar`, recalcula
  `total`) mientras esté `PENDIENTE`/`VENCIDA`; `anular` rechaza si ya
  está `PAGADA` o si tiene algún `PagoPlataforma` registrado (evita
  reversar cobros parciales ya hechos).
- **`PagoPlataforma`**: mismo patrón de pagos parciales que `Pago` de
  tenant (`PagosPlataformaService`, `EPSILON = 0.005` de tolerancia de
  redondeo, marca `PAGADA` + `fechaPago` cuando el acumulado cubre el
  `total`) pero simplificado — sin `EventBusService` (tenant-scoped, no
  aplica) ni `CierrePeriodoService` (no hay contabilidad de plataforma).
  Reutiliza el enum `MetodoPago` ya existente. `registradoPorId` es
  nullable con `onDelete: SetNull` (mismo criterio que
  `PlatformAuditLog.adminId`): borrar un admin no debe bloquear ni hacer
  desaparecer los pagos que registró.

`FacturasPlataformaCronService` (`@Cron(EVERY_DAY_AT_8AM)`, mismo patrón
que `RecordatoriosService` — `PrismaService` global, sin contexto de
tenant) hace dos pasadas diarias:

1. `generarFacturasDelDia()`: por cada `Suscripcion` `ACTIVA` con
   `fechaProximoCorte` vencida, genera la factura
   (`FacturasPlataformaService.generarDesdeSuscripcion`, reutilizado
   también por "generar factura ahora" manual desde
   `/plataforma/tenants`) y avanza `fechaProximoCorte` sumando 1 mes o 1
   año según `Plan.cicloFacturacion` (`sumarCiclo()`, `setMonth`/
   `setFullYear` nativos — no hay librería de fechas en el proyecto).
2. `marcarVencidasYAplicarMora()`: por cada factura `PENDIENTE` ya
   vencida, aplica `feeMoraPct` sobre el total **una sola vez** (no
   compone día a día) y la pasa a `VENCIDA`.

Ambos pasos notifican por email al usuario `Admin Total` más antiguo del
tenant (`EmailChannel.enviar()` directo, HTML inline — mismo criterio
que `PlatformAuthService.olvidePassword`, sin pasar por el sistema de
plantillas por-tenant de `NotificacionesService`, que no aplica acá). Es
un email simple por evento, no el sistema completo de "N avisos
configurables con offsets de días + canal activable" de una fase futura
— esa richness se construye después, sobre este mismo cron.

Permisos nuevos en el catálogo de plataforma:
`platform.facturacion.ver`/`.gestionar`, `platform.pagos.registrar`
(separado de `.gestionar` a propósito — un rol puede poder cobrar sin
poder editar descuentos/mora).

**Facturas manuales con líneas múltiples** (`POST /platform/facturas`,
permiso `platform.facturacion.gestionar`): además del ciclo automático,
el super admin puede facturarle a un tenant un cargo puntual (ej.
configuración inicial, capacitación) con varios conceptos/montos.
`FacturaPlataformaLinea` es un modelo hijo nuevo (`onDelete: Cascade`)
— retrocompatible a propósito: `FacturaPlataforma.concepto`/`monto`/
`total` siguen siendo el agregado para TODA factura (auto-generada o
manual), `generarDesdeSuscripcion()` (cron + "generar factura ahora")
queda intacto y sigue creando con `lineas: []`. Solo la creación manual
llena `lineas` — `monto`/`total` = suma de las líneas, `concepto` =
el de la primera línea (+"(+N más)" si hay varias). Requiere que el
tenant ya tenga `Suscripcion` (siempre la tiene desde el provisioning);
si no, 400 explícito en vez de una FK violation cruda. Editar líneas de
una factura ya creada queda fuera de alcance a propósito — el camino
para corregir una factura manual mal hecha es anularla y recrearla,
igual criterio que notas de crédito/débito en vez de edición in-place.

## Pasarela de pago (`backend/src/facturacion-plataforma/pasarela/`)

Quién paga: **el admin del tenant**, no la plataforma — llega desde un
link público en el email que ya envía `notificarFactura()`
(`/pagar/:facturaId`, sin autenticación, prefijo backend
`/api/pagos-publicos/**` para no chocar con `/api/facturas` de tenant ni
`/api/platform/facturas`). Diseñada como **adaptador intercambiable**:

```ts
interface PasarelaPagoAdapter {
  readonly clave: string;
  readonly habilitado: boolean;
  crearSesionPago(params: CrearSesionPagoParams): Promise<SesionPagoResultado>;
}
```

`PasarelaPagoService.activa` resuelve cuál usar según
`PASARELA_PAGO_ACTIVA` (default `'stripe'`) — ni el controller público
ni `PagosPlataformaService` conocen la pasarela concreta.

- **`StripeAdapter`**: la única realmente conectada. `fetch` nativo
  directo contra `POST https://api.stripe.com/v1/checkout/sessions`
  (form-urlencoded) — mismo criterio que `IaClientService` con
  Anthropic: es un solo POST, no justifica agregar el SDK oficial
  `stripe` como dependencia. Sin `STRIPE_SECRET_KEY`, `crearSesionPago`
  lanza `ServiceUnavailableException` sin llegar a llamar `fetch` (nunca
  crashea la app). `client_reference_id`/`metadata[facturaId]` llevan el
  id de la factura para que el webhook sepa qué marcar.
- **`AzulAdapter`/`CardNetAdapter`**: stubs (`habilitado: false`,
  lanzan `ServiceUnavailableException`) — demuestran que el patrón
  admite sumar la pasarela real después sin tocar
  `PasarelaPagoService`, el controller ni `PagosPlataformaService`.

**Verificación de firma del webhook** (`stripe-webhook.util.ts`,
`verificarFirmaStripe`): hand-rolled con `crypto` nativo (HMAC-SHA256
sobre `${timestamp}.${body}`, comparación con `timingSafeEqual`, ventana
de tolerancia anti-replay de 300s) — mismo criterio de `crypto` nativo
que ya usa `password-reset-token.ts`, tampoco justifica el SDK. Requiere
el body **crudo** (no el ya parseado a JSON), por eso
`NestFactory.create(AppModule, { rawBody: true })` en `main.ts` — deja
`request.rawBody: Buffer` disponible en toda la app sin desactivar el
parseo JSON normal del resto de las rutas.

`POST /api/pagos-publicos/webhook/stripe` → firma inválida = 400 sin
tocar nada; en `checkout.session.completed`, llama
`PagosPlataformaService.registrarPagoGateway(metadata.facturaId, {
monto, referenciaExterna: session.id })` — **idempotente a propósito**
(no-op si la factura ya está `PAGADA`/`ANULADA`, nunca lanza): Stripe
reintenta el webhook si no recibe 200, así que debe poder llamarse de
nuevo sin duplicar el pago. El pago queda con `metodoPago: 'TARJETA'` y
`registradoPorId: null` (nadie de plataforma lo registró).

**Limitación conocida de esta fase**: Stripe no liquida en DOP
directo — el cobro se hace en `STRIPE_CURRENCY` (default `usd`) con el
mismo monto numérico de la factura, **sin conversión de tasa de
cambio**. Facturar en DOP real requeriría configurar la cuenta de
Stripe para liquidar en DOP o aplicar una tasa de conversión — fuera de
alcance de esta fase.

## Configuración de plataforma (`backend/src/plataforma-config/`)

Antes de esta fase, la pasarela de pago, SMTP y Twilio solo se
configuraban editando `.env` a mano y reiniciando el backend — no había
ninguna pantalla para el super admin. `PlataformaConfiguracion` es un
modelo Prisma **fila única** (primer precedente de este patrón en el
schema: `findFirst({ orderBy: { createdAt: 'asc' } })` + crea con
defaults si no existe ninguna — determinístico incluso si una carrera
rarísima llegara a crear dos filas, algo que de hecho ocurrió una vez en
desarrollo). Todos sus campos son `null`-ables a propósito: `null`
significa "sin override, seguir usando `.env`".

**Cifrado**: los campos de secreto (`smtpPasswordCifrado`,
`twilioAuthTokenCifrado`, `stripeSecretKeyCifrado`,
`stripeWebhookSecretCifrado`, `webhookSecretCifrado`) se guardan con
AES-256-GCM vía `crypto` nativo (`backend/src/common/utils/encriptado.util.ts`,
`cifrar`/`descifrar`) — mismo criterio que el resto del proyecto para
todo lo relacionado a un solo secreto (sin SDK/dependencia nueva).
Requiere la env var `ENCRYPTION_KEY` (`openssl rand -hex 32`) **solo al
momento de guardar** un campo cifrado — si falta, `actualizar()`
responde 400 en vez de guardar en texto plano. `GET
/platform/configuracion` **nunca** devuelve un secreto en claro: expone
`{campo}Configurado: boolean` en su lugar. `PATCH` interpreta el valor
recibido con la convención: string no vacío = nuevo valor (se cifra
server-side), `""` = borra el override (vuelve a `.env`), campo
omitido = sin cambios.

**Decisión de diseño clave** (para no tocar código ya estable): en vez
de inyectar este servicio en `EmailChannel`/`WhatsAppChannel`/
`StripeAdapter`/`PasarelaPagoService`, `sincronizarEnv()` escribe los
valores guardados **directo en `process.env`** — una vez en
`onModuleInit()` (arranque) y de nuevo después de cada `actualizar()`
exitoso. Solo pisa `process.env.CLAVE` cuando el campo correspondiente
no es `null` en la fila, así una instalación sin nada guardado en la UI
sigue funcionando 100% igual que antes, solo por `.env`. Tres de los
cuatro canales (`WhatsAppChannel`, `StripeAdapter`,
`PasarelaPagoService.activa`) ya leían `process.env` fresco en cada
llamada — recogen el cambio sin reiniciar el backend sin que se les
toque una sola línea. `EmailChannel` sí se ajustó: el transporter de
Nodemailer pasó de construirse una sola vez (inicializador de campo) a
construirse dentro de `enviar()`, leyendo `process.env` en ese momento.

**Permisos** `platform.configuracion.ver`/`.gestionar`: solo el rol
"Super Admin" los tiene por defecto (igual criterio de sensibilidad que
`platform.admins.gestionar`) — nunca se agregan a Ventas/Soporte,
porque exponen si hay credenciales de SMTP/Twilio/Stripe configuradas.

**Alcance recortado a propósito**: el bloque "webhook de plataforma"
(pensado para n8n u otro sistema externo) solo guarda el dato de
conexión (URL + secreto + activo/inactivo) — todavía no dispara nada.
Conectarlo a eventos reales (factura generada/vencida) queda para una
fase posterior, cuando exista un Event Bus de plataforma equivalente al
de tenants.

## Event Bus

`EventBusService` (`backend/src/event-bus/`) envuelve `EventEmitter2` de
`@nestjs/event-emitter` para desacoplar módulos: Facturación emite
`factura.creada`/`factura.anulada`, Inventario emite
`inventario.stock_bajo`, Compras emite `compras.orden_recibida`. Ningún
módulo de negocio conoce a Notificaciones ni a Webhooks — ambos se
suscriben de forma independiente a los mismos eventos (`@OnEvent(...)` en
sus servicios), lo que permite agregar nuevos "reactores" a eventos de
negocio sin tocar el módulo que los emite.

## Notificaciones

Canales: Email (Nodemailer), WhatsApp (API de Twilio, ver abajo) e In-App
(registro consultable vía `GET /notificaciones`); SMS queda fuera todavía.
Plantillas dinámicas con `{{variables}}` (`notificacion_plantillas`),
administradas por tenant vía `POST /notificaciones/plantillas` — cada
canal tiene su propia plantilla por clave (`tenantId, canal, clave` es la
llave única), así que un tenant puede tener una plantilla de email y otra
de WhatsApp (con distinto texto) para el mismo evento `factura_creada`.
Los listeners de eventos (`NotificacionesService.alFacturarse`,
`.alBajarStock`) corren fuera de un request HTTP, por lo que usan el
`PrismaService` singleton con `tenantId` explícito en cada query en vez
de `TenantPrismaService` (que es request-scoped y no está disponible ahí).

**WhatsApp** (`notificaciones/canales/whatsapp.channel.ts`): pega
directo a la REST API de Twilio (Basic Auth + un POST
form-urlencoded) en vez de usar el SDK oficial — es literalmente un
`fetch`, no justifica una dependencia nueva para algo que está
deshabilitado por defecto. Sin `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
`TWILIO_WHATSAPP_FROM` configuradas, loguea y no envía — mismo patrón que
`EmailChannel` con `EMAIL_HABILITADO=false`, para que el resto del flujo
(guardar la notificación, marcarla `FALLIDA`) funcione igual en dev sin
cuenta de Twilio.

`alFacturarse` intenta **ambos** canales de forma independiente según qué
datos tenga el cliente: email si tiene `email`, WhatsApp si tiene
`telefono` — ninguno de los dos bloquea al otro, y si no hay plantilla
`WHATSAPP` activa para esa clave, `enviar()` simplemente no hace nada
(no es un error). `alBajarStock` (notifica a admins internos, no a
clientes) sigue siendo solo por email porque `User` no tiene un campo de
teléfono — agregarlo sería la extensión natural si se necesita alertar
por WhatsApp a los admins también.

## Recordatorios automáticos de cobro

`RecordatoriosService` (`backend/src/recordatorios/`) corre un
`@Cron` diario (8am, `ScheduleModule.forRoot()` registrado una vez en
`AppModule`) que busca facturas `tipoFactura: CREDITO`, `estado: EMITIDA`
y `pagada: false` **en todos los tenants** (usa `PrismaService` global,
igual que los listeners de notificaciones — no hay contexto de tenant en
un cron) y filtra en memoria las que ya pasaron `fecha + plazoPagoDias`
(no se hizo con una condición SQL porque `plazoPagoDias` varía por fila;
al volumen esperado, traer las facturas a crédito sin pagar y filtrar en
JS es más simple que la alternativa en SQL crudo). Reusa el mismo
`NotificacionesService.enviar()` con la clave `factura_vencida` — por
email si el cliente tiene correo, por WhatsApp si tiene teléfono.

`Factura.pagada`/`fechaPago` se marcan vía
`POST /facturas/:id/registrar-pago` (permiso `facturacion.cobrar`) — sin
este endpoint, el campo nunca se pone en `true` y los recordatorios
seguirían disparando para siempre. No hay todavía conciliación con pagos
parciales ni con el módulo de contabilidad (ver abajo) — es un booleano
simple, "pagada del todo o no".

## Contabilidad (partida doble)

`backend/src/contabilidad/` implementa un libro contable de partida
doble: catálogo de cuentas (`CuentaContable`, con `tipo`
ACTIVO/PASIVO/PATRIMONIO/INGRESO/GASTO y `naturaleza`
DEUDORA/ACREEDORA) y asientos (`AsientoContable` + `LineaAsiento`).
`AsientosContablesService.validarBalance()` rechaza cualquier asiento
donde `sum(debito) !== sum(credito)` (tolerancia de 0.005 por
redondeo) — no existe forma de persistir un asiento desbalanceado, ni
manual ni automático.

**Catálogo base** (`cuentas-base.ts`, 11 cuentas: Caja y Bancos,
Cuentas por Cobrar, Inventario, ITBIS Adelantado, Cuentas por Pagar,
ITBIS por Pagar, Capital Social, Utilidades Retenidas, Ingresos por
Ventas, Costo de Ventas, Gastos Operativos) se siembra igual que
`ROLES_BASE`: en `TenantsRepository.crearConProvisioning()` para
tenants nuevos y en `prisma/seed.ts` para el tenant demo.

**Generación automática vía Event Bus**: `ContabilidadEventosService`
se suscribe a `factura.creada`, `factura.anulada` y
`compras.orden_recibida` (los mismos eventos que ya consumen
Notificaciones y Webhooks) y genera el asiento correspondiente sin que
`FacturacionService`/`ComprasService` sepan que Contabilidad existe.
Cada handler está envuelto en try/catch que solo loguea — un fallo
generando el asiento **nunca** revierte ni bloquea la venta/compra que
lo originó, porque el listener corre después (fire-and-forget) de que
la respuesta HTTP ya se envió.

- **Venta CONTADO**: débito Caja, crédito Ingresos + ITBIS por Pagar.
- **Venta CREDITO/NOTA_DEBITO**: débito Cuentas por Cobrar en vez de
  Caja.
- **NOTA_CREDITO**: como `subtotal`/`itbis`/`total` ya llegan en
  **negativo** (ver sección de notas de crédito/débito arriba),
  `lineaSegunSigno()` reutiliza la misma fórmula y automáticamente
  invierte débito/crédito sin una rama de código aparte.
- **Anular una factura**: `generarReversaFactura` genera el asiento
  contrario exacto (mismos montos, negados) — no se edita ni borra el
  asiento original, se contrarresta con uno nuevo, preservando el
  historial completo.
- **Compra recibida**: débito Inventario + ITBIS Adelantado, crédito
  Cuentas por Pagar por el total.

**Anular un asiento MANUAL o GASTO** (`AsientosContablesService.anular`,
`POST /contabilidad/asientos/:id/anular`, permiso `contabilidad.anular`):
mismo principio que anular una factura — genera un asiento reverso
(origen `ANULACION`, débito/crédito invertidos) y marca `anulado: true`
en el original, **nunca lo edita ni lo excluye de los cálculos
financieros**. Esto es deliberado: el original sigue contando en
`lineasHasta`/`lineasEnRango`/etc., pero el reverso lo cancela
matemáticamente (mismo mecanismo, sin filtro especial, que ya usan las
reversas de Factura/Compra) — filtrar por `anulado` ahí sería un bug:
excluiría la mitad de la cancelación y el reverso terminaría restando
dos veces. `anulado` es puramente informativo (badge en el listado).
Solo se puede anular un asiento de origen `MANUAL`/`GASTO` (los que crea
directamente el usuario) — los automáticos ya tienen su propio mecanismo
de reversa atado al documento que los originó, y `CIERRE` nunca se toca
directamente. Respeta el cierre de período: no se puede anular un
asiento fechado en o antes del último cierre.

**Cierre de período** (`CierrePeriodoService.cerrarPeriodo`,
`POST /contabilidad/cierre-periodo`, permiso `contabilidad.cerrarperiodo`):
traspasa el saldo neto de INGRESO/GASTO acumulado hasta la fecha de
corte a Utilidades Retenidas. `validarFechaAbierta` (método público,
único punto donde se valida una fecha contra el último cierre) la usan
`AsientosContablesService` (`crear`/`crearGasto`/`anular`) y
`PagosService`/`GastosMenoresService` — estas dos últimas son las
**únicas rutas de negocio con fecha manual retroactiva** (`Pago.fecha`,
`GastoMenor.fecha`); Facturación/Compras/Nómina siempre generan su
asiento con la fecha de "ahora", así que nunca caen dentro de un período
ya cerrado en la práctica y no necesitan esta validación.

**Conciliación bancaria manual** (`EstadosFinancierosService.conciliacionBancaria`/
`marcarLineaConciliada`, `GET/PATCH /contabilidad/conciliacion/...`,
permiso `contabilidad.conciliar` para marcar): sin importar extractos ni
auto-match — cada `LineaAsiento` que toca la cuenta contable vinculada a
una `CuentaBancaria` se marca conciliada a mano (`conciliado`/
`conciliadoEn`), comparando visualmente contra el estado de cuenta del
banco. El saldo se separa en conciliado/pendiente reusando `libroMayor`
internamente. `marcarLineaConciliada` valida pertenencia al tenant
resolviendo el `asiento` padre por separado con `buscarPorId` (que sí
está en `TENANT_SCOPED_MODELS`) en vez de un `include: { asiento: true }`
sobre la línea: `LineaAsiento` no tiene RLS propio, y si el `include`
tocara un asiento de otro tenant, la relación requerida volvería `null`
por RLS y Prisma lanzaría `PrismaClientUnknownRequestError` (500) en vez
de un 404 limpio — el mismo tipo de trampa ya documentado para tablas
hijas sin `tenantId` propio.

**Balance de comprobación** (`EstadosFinancierosService.balanceComprobacion`,
`GET /contabilidad/balance-comprobacion`): a diferencia de
`balanceGeneral()`/`estadoResultados()` (que separan por grupo de
cuentas), agrega TODAS las cuentas a la vez con su total débito/crédito
y saldo — el formato clásico de balanza de comprobación, útil para
verificar que todo balancea antes de cerrar un período.

**Patrón de doble repositorio** (igual al ya usado en Webhooks):
`CuentasContablesRepository`/`AsientosContablesRepository` tienen
métodos `TenantPrismaService`-based (`crear`, `listar`,
`buscarPorCodigo`, para el flujo HTTP normal) y métodos "Global"
(`crearGlobal`, `buscarPorCodigoGlobal`, con `PrismaService` inyectado
+ `tenantId` explícito) para uso desde los listeners de eventos, que
corren fuera de un contexto de request y no tienen acceso al
`TenantPrismaService` request-scoped.

**Estados financieros** (`EstadosFinancierosService`): `balanceGeneral()`
agrega saldos de todas las líneas hasta una fecha; `estadoResultados()`
agrega INGRESO/GASTO dentro de un rango (mes actual por defecto).

**"Resultado del Ejercicio" — por qué existe esta línea sintética**:
este sistema no implementa un proceso de cierre de período (no hay
"cerrar el mes" que traslade INGRESO/GASTO contra Utilidades
Retenidas). Sin ese cierre, cada venta aumenta el Activo (Caja/CxC)
pero su contrapartida vive en una cuenta de INGRESO, que por
definición no es Activo/Pasivo/Patrimonio — así que
`Activo = Pasivo + Patrimonio` dejaría de cumplirse apenas hubiera una
venta. `balanceGeneral()` calcula `resultadoEjercicio` (ingresos menos
gastos acumulados a la fecha) y lo inyecta como una línea sintética
`3099 — Resultado del Ejercicio (no distribuido)` dentro del grupo
PATRIMONIO — el tratamiento contable estándar para un balance *antes*
del cierre anual. Es la razón por la que el balance general siempre
debe cuadrar (`diferencia ≈ 0`) sin necesitar ese cierre.

**Fuera de alcance deliberadamente**: edición in-place de un asiento ya
creado (solo anulación vía reverso, nunca `PATCH`); importar extractos
bancarios o hacer auto-match en la conciliación (100% manual); bloquear
retroactivamente los asientos automáticos de Factura/Compra/Nómina
contra un cierre de período (no lo necesitan — ver arriba); y granularidad
de permisos más allá de `contabilidad.ver/editar/anular/cerrarperiodo/conciliar`
(por ejemplo, un permiso de auditoría separado de `contabilidad.ver`).

## Nómina

`backend/src/nomina/` cubre el ciclo de nómina de un empleado: catálogo de
empleados (`Empleado`), períodos (`PeriodoNomina`,
`QUINCENAL`/`MENSUAL`) y un recibo por empleado por período
(`ReciboNomina`), con el mismo flujo de tres estados que un documento
fiscal: `BORRADOR → PROCESADO → PAGADO`.

- **`POST /nomina/periodos` (generar)**: crea el período en `BORRADOR` y
  un `ReciboNomina` por cada empleado **activo**, calculado con
  `calcularRecibo()` (`calculo-nomina.ts`) sobre el `salarioBrutoMensual`
  vigente de cada empleado en ese momento — cambiar el salario de un
  empleado nunca reescribe recibos de períodos ya generados.
- **`.../procesar`**: `BORRADOR → PROCESADO`, congela el período (ya no
  se puede volver a generar).
- **`.../marcar-pagado`**: `PROCESADO → PAGADO`, y es el único paso que
  emite `nomina.periodo_pagado` — el mismo Event Bus que ya usan
  Facturación/Compras, consumido por `ContabilidadEventosService.alPagarNomina`
  para generar el asiento automático (ver abajo). Antes de ese evento, un
  período procesado no tiene ningún efecto contable.

**Cálculo de TSS e ISR** (`nomina-config.ts`, `isr.util.ts`,
`calculo-nomina.ts`): tasas de Ley 87-01 (SFS 3.04%/7.09% empleado/
empleador, AFP 2.87%/7.10%, INFOTEP 1% solo empleador) con sus topes de
salario cotizable, y la escala progresiva de ISR de la Ley 11-92 Art.
296 (4 tramos, congelada desde 2018). **Mismo disclaimer que el layout
DGII 606/607/608**: estos números se investigaron pero no se pudieron
verificar contra la fuente oficial en tiempo real — confirmar contra la
resolución DGII/TSS vigente antes de procesar nómina real, especialmente
los topes de TSS (se recalculan cada vez que sube el salario mínimo).

Los topes y tasas se evalúan siempre sobre el **salario mensual
completo** del empleado, nunca sobre el monto ya prorrateado — un
período `QUINCENAL` calcula primero los montos mensuales y recién
después los multiplica por `factorPeriodo` (0.5). Aplicar el tope al
salario quincenal directamente daría un resultado distinto (e
incorrecto) al de calcularlo sobre el salario mensual real, que es como
lo hace la TSS.

**Asiento automático** (`AsientosContablesService.generarDesdeNomina`,
origen `NOMINA`): débito `Gastos de Nómina` (bruto + aportes
patronales — el costo laboral real de la empresa), crédito `Caja y
Bancos` (neto pagado a los empleados) y crédito `TSS e ISR por Pagar`
(retenciones al empleado + aportes patronales, lo que se le debe a
TSS/DGII y aún no se ha remitido). **Simplificación de v1**:
`otrasDeducciones` (descuentos no fiscales, p. ej. un préstamo interno)
se agrupa también en `TSS e ISR por Pagar` en vez de tener su propia
sub-cuenta — si el negocio necesita rastrear eso por separado, es la
extensión natural.

**Fuera de alcance deliberadamente**: pago de horas extra/comisiones/
bonificaciones (solo salario fijo mensual por ahora), liquidación por
despido (preaviso + cesantía del Art. 80), vacaciones y regalía pascual
(salario 13), remesa real a la TSS/DGII (el asiento registra la
obligación, no la transferencia bancaria de pago a esas entidades), y
control de asistencia/horas trabajadas.

## POS (punto de venta)

`backend/src/pos/` es una capa delgada sobre Facturación: no duplica
NCF/ITBIS/descuento de stock, solo agrega el concepto de **turno de
caja** (`TurnoCaja`) y llama a `FacturacionService.crear()` igual que
Cotizaciones/Remisiones. **Sin modo offline en v1** — cada acción
(abrir turno, vender, cerrar) es una llamada HTTP normal; no hay cola
local ni sincronización diferida, así que el POS requiere conectividad
para operar (ver "Fuera de alcance" abajo).

- **`POST /pos/turnos` (abrir)**: solo puede haber **un turno `ABIERTO`
  por bodega a la vez** — `PosService.abrirTurno` lo valida en código
  (no hay una constraint de DB para "a lo sumo un ABIERTO", porque eso
  depende del `estado`, no de una combinación fija de columnas).
- **`POST /pos/ventas`**: fuerza `tipoFactura: 'CONTADO'` (el POS no
  vende a crédito en v1) y toma la `bodegaId` **del turno**, no del
  request — evita que una venta se registre contra una bodega distinta
  a la de la caja que la cobra. Como reutiliza
  `FacturacionService.crear()` tal cual, la venta **ya emite
  `factura.creada`** y por lo tanto **ya genera su asiento contable
  automático** (ver la sección de Contabilidad) sin ningún código
  adicional — es el mismo beneficio que ya tenían Cotizaciones/
  Remisiones al convertir.
- **`Factura.metodoPago`/`Factura.turnoCajaId`** son nullable y
  **solo los llena una venta de POS** — el resto de la facturación
  (venta normal desde el módulo de Facturación, conversión de
  cotización/remisión) los deja `null`. `FacturacionService.crear()`
  acepta un tercer parámetro opcional (`{ metodoPago, turnoCajaId }`)
  para esto, sin tocar `CrearFacturaDto` (que sigue validando solo lo
  que la ruta HTTP de Facturación necesita).
- **`POST /pos/turnos/:id/movimientos`**: entradas/salidas de efectivo
  que NO son una venta (retiro para gasto menor, ingreso de vuelto
  adicional). Las ventas ya se contabilizan solas vía
  `Factura.turnoCajaId` — no generan una fila en `MovimientoCaja`.
- **`POST /pos/turnos/:id/cerrar`**: `montoEsperado = montoInicial +
  Σ(ventas con metodoPago EFECTIVO de este turno) + Σ(entradas) -
  Σ(salidas)`; `diferencia = montoFinalContado - montoEsperado`. Ventas
  con tarjeta/transferencia no se cuentan en el efectivo esperado (ese
  dinero nunca pasó por la caja física).
- **Arqueo: quién abre, quién cierra, y la tolerancia.** `TurnoCaja`
  guarda `cajeroId` (quien lo abrió) y `cerradoPorId` (quien lo cerró) —
  dos relaciones distintas a `User` (`cerradoPor` usa el nombre de
  relación explícito `"TurnoCajaCerradoPor"` porque Prisma ya tiene la
  relación por defecto vía `cajeroId`). Por defecto **solo el cajero que
  abrió puede cerrarlo**; alguien con el permiso `pos.supervisar` puede
  cerrar el turno de cualquier cajero (`PosService.cerrarTurno` lo valida
  en código, antes de calcular el arqueo). Si `|diferencia|` supera la
  tolerancia configurada del tenant (`Configuracion.POS_TOLERANCIA_ARQUEO`,
  default RD$50 — ver `CONFIGURACIONES_BASE`), el cierre exige
  `justificacionDiferencia`; es la primera `Configuracion` que el backend
  efectivamente lee para una regla de negocio (el resto, como
  `ITBIS_GENERAL`/`RETENCION_ISR_TASA`, son solo de referencia, nunca
  consumidas programáticamente — `ConfiguracionesService.buscarValor`
  cae a un default si el tenant todavía no tiene la clave sembrada).
  `GET /pos/turnos` admite filtrar por `cajeroId`/`estado`/`desde`/`hasta`,
  y `GET /pos/cajeros` lista los cajeros distintos con turnos — sin
  requerir el permiso `admin.usuarios` que protege `GET /admin/usuarios`.

**Fuera de alcance deliberadamente**: modo offline/sincronización
diferida (de ahí el nombre de esta sección — es la razón de ser del
"sin offline en v1"), pagos con tarjeta procesados de verdad
(`metodoPago: TARJETA` solo registra la intención, no integra una
pasarela), y pagos divididos (una venta usa un solo `metodoPago`, no
un mix efectivo+tarjeta en la misma factura). La impresión de tickets sí
está cubierta — ver la sección siguiente.

## Impresión multi-formato (Facturación/Cotizaciones/Remisiones/POS)

Antes, Facturación/Cotizaciones/Remisiones solo generaban PDF a tamaño
carta fijo (`pdfkit`) y el POS no imprimía nada. `GET /:id/imprimir`
(sibling de los `/pdf` existentes, que se dejan intactos por
compatibilidad) resuelve un `FormatoImpresion` (`CARTA`/`A4`/
`TERMICA_80MM`/`TERMICA_58MM`, enum Prisma) y devuelve **PDF** para los
dos primeros o **HTML angosto** (`text/html`) para los térmicos — el
backend decide el `Content-Type` según el formato, el frontend siempre
llama al mismo endpoint, lee el `Content-Type` de la respuesta, y abre
el blob (mismo patrón `abrirBlob` de siempre). El HTML térmico
(`backend/src/common/pdf/documento-ticket.ts`) trae
`window.print()` en un `<script>` — se abre en una pestaña y el
navegador dispara el diálogo de impresión del sistema operativo solo:
**sin ESC/POS crudo, sin WebUSB, sin agente local** — la impresora
térmica solo necesita estar instalada como impresora normal de Windows
(USB o red).

`documento-ticket.ts` y `documento-pdf.ts` consumen la MISMA forma de
datos (`DocumentoPdfParams`) que ya arma cada servicio — cero
duplicación de lógica de negocio entre el PDF y el ticket. Como el
ticket se arma por concatenación de strings HTML (no PDFKit, que nunca
interpreta su texto como markup) y se abre en una pestaña real,
**escapa todo campo interpolado que pueda venir influenciado por el
usuario final** (nombre de producto, nombre de cliente) — sin esto,
sería un XSS almacenado real que no existe en el PDF.

**Resolución del formato** (`backend/src/common/impresion/
resolver-formato-impresion.ts`, función pura — mismo espíritu que
`resolver-modulos-activos.ts`): un `?formato=` explícito en la query
manda siempre (elegido al momento de imprimir, nunca se persiste); si
se omite, gana el override de la `Bodega` de ese documento
(`Bodega.formatoImpresion`, nullable) sobre el default del tenant
(`Configuracion.FORMATO_IMPRESION_DEFAULT`, reutiliza la tabla
clave-valor genérica en vez de una columna nueva); si nada está
configurado, cae al fallback duro `'CARTA'`. `Cotizacion` no tiene
`bodegaId` (no toca stock hasta convertirse en factura) — solo aplica
el default de tenant, sin override posible. El POS no necesita ningún
endpoint propio: una venta de POS ya es una `Factura` real
(`PosService.registrarVenta` delega en `FacturacionService.crear()`),
así que un recibo de POS se imprime contra el mismo
`GET /facturas/:id/imprimir`.

## IA (asistente de negocio, transversal a varios módulos)

`backend/src/ia/` no es un módulo de negocio propio — son tres
capacidades pequeñas que se apoyan en módulos que ya existen
(Reportes, Contabilidad) para dar una capa de lenguaje natural /
sugerencia encima de datos reales del tenant. `IaClientService`
(`ia-client.service.ts`) es el único punto que habla con una API
externa (la Messages API de Anthropic, vía `fetch` directo — mismo
criterio que `WhatsAppChannel` con Twilio: es un solo POST, no
justifica el SDK oficial como dependencia).

**Degradación explícita sin `ANTHROPIC_API_KEY`** (mismo patrón que
`EmailChannel`/`WhatsAppChannel`, pero adaptado a que estos SÍ son
endpoints síncronos que un usuario espera ver responder, no
notificaciones fire-and-forget): en vez de fallar o devolver vacío,
cada método cae a un modo heurístico que sigue siendo útil sin LLM:

- **`POST /ia/asistente`**: arma un resumen del dashboard real del
  tenant (`ReportesService.dashboard`) y se lo pasa como contexto al
  modelo junto con la pregunta del usuario. Sin API key, devuelve el
  resumen numérico crudo tal cual (sigue siendo información real, solo
  sin la redacción en lenguaje natural). La respuesta siempre incluye
  `generadaConIa: boolean` para que el frontend pueda distinguir ambos
  casos.
- **`POST /ia/sugerir-cuenta-contable`**: dado un concepto de gasto en
  texto libre, sugiere una cuenta del catálogo del tenant (filtrado a
  tipo `GASTO`/`ACTIVO` — nunca sugiere una cuenta de `INGRESO` para un
  gasto). Sin IA, usa una heurística de coincidencia de palabras entre
  el concepto y el nombre de cada cuenta (`sugerirPorHeuristica`); si no
  hay ninguna coincidencia, devuelve `null` en vez de inventar una
  cuenta al azar.
- **`POST /ia/generar-descripcion-producto`**: redacta una descripción
  de venta corta a partir de nombre/categoría. Sin IA, devuelve una
  descripción básica no redactada.

**Fuera de alcance deliberadamente**: RAG real sobre los datos del
tenant (el contexto que se le pasa al modelo es un resumen agregado,
no una búsqueda semántica sobre facturas/productos individuales),
conversación con memoria entre turnos (cada pregunta es una llamada
independiente, sin historial), y aplicar automáticamente la cuenta
contable sugerida (el endpoint solo sugiere — asentar el gasto sigue
siendo una acción manual del usuario vía `POST /contabilidad/asientos`).

## Webhooks de tenant

Cada tenant administra sus propios webhooks (`webhooks` table) vía UI
completa (`/admin` → Webhooks). `WebhooksService` se suscribe a los
mismos eventos de negocio que Notificaciones y hace POST firmado
(HMAC-SHA256 sobre el secret del webhook, header `X-Sol-Signature`) a
cada URL activa suscrita a ese evento. Antes de guardar un webhook,
`ssrf-guard.ts` resuelve el hostname y rechaza IPs privadas/loopback/
link-local para evitar SSRF hacia infraestructura interna.

**Reintento con backoff**: el listener corre desacoplado del request HTTP
que originó el evento (fire-and-forget vía el event bus), así que puede
permitirse reintentar sin bloquear a nadie. `WebhooksService.intentarEntrega`
hace hasta 3 intentos (sin espera, luego 2s, luego 8s) antes de registrar
el fallo definitivo en `webhook_deliveries.intentos`; un `respuesta.ok`
en cualquier intento corta el ciclo ahí mismo. No hay cola/reintento
diferido más allá de esos 3 intentos (nada tipo "reintentar en 1 hora") —
si el endpoint del tenant estuvo caído más de ~10 segundos, la entrega
queda marcada `exitoso: false` y no se retoma sola.

## Caché y rate-limiting con Redis

`RedisService` (`backend/src/redis/`, módulo `@Global()`) envuelve un
único cliente `ioredis` compartido por todo el proceso.

- **Caché de reportes**: `ReportesService.dashboard()` y
  `.reporteInventario()` cachean su resultado por tenant
  (`reportes:dashboard:<tenantId>`, `reportes:inventario:<tenantId>`) con
  TTL de 30s. No hay invalidación activa al crear una factura o mover
  stock — el TTL corto es la única garantía de frescura, a cambio de
  simplicidad; una factura recién creada puede no reflejarse en el
  dashboard hasta 30s después.
- **Rate-limiting distribuido**: `RedisThrottlerStorage` implementa la
  interfaz `ThrottlerStorage` de `@nestjs/throttler` con un script Lua
  (`EVAL`, atómico) en vez del `Map` en memoria por defecto — necesario
  porque el contador en memoria no se comparte entre instancias del API;
  con Redis, N réplicas del backend cuentan contra el mismo límite.
  Conectado en `ThrottlerModule.forRootAsync` (`app.module.ts`).

**Nota de desarrollo**: con el stack corriendo vía `docker compose up`
(navegador → proxy de Vite en `web` → `api`), pedidos idénticos y
consecutivos pueden generar claves de throttler *distintas* en Redis —
es una inestabilidad de `req.ip` específica del salto por el proxy de
Vite (probablemente relacionado al mismo comportamiento IPv4/IPv6 que
`NODE_OPTIONS=--no-network-family-autoselection` mitiga para el
`ECONNREFUSED` de ese mismo proxy, ver DEVELOPMENT.md). Pegándole
directo al puerto del backend (`:3000`, sin pasar por Vite) la key es
estable y el conteo incrementa correctamente — verificado a mano. No se
investigó más a fondo porque es un artefacto del proxy de desarrollo, no
del código de rate-limiting en sí.

## n8n

Self-hosted, como contenedor más en `docker-compose.yml`. Los workflows
iniciales sugeridos (alerta de stock bajo, reporte de ventas diario)
consumen los mismos webhooks de tenant — no hay una integración especial
"n8n-only"; n8n es simplemente un cliente más de los webhooks.

## Integración con MSSQL

Opcional por tenant (`tenant_settings.mssqlHabilitado` + credenciales).
Solo lectura: artículos, costos, clientes, histórico de ventas,
proveedores. No incluida en este scaffold como módulo activo — el
paquete `mssql` ya está en las dependencias del backend para cuando se
implemente el conector de sincronización (Fase 3).

## Auditoría

`AuditLogInterceptor` (global, `APP_INTERCEPTOR`) escribe una fila
después de cada `POST/PATCH/PUT/DELETE` autenticado, y decide la tabla
según qué payload trae `request.user`:

- **Tenant** (`request.user.tenantId` presente): fila en `audit_logs`
  (usuario, tenant, acción, entidad, IP, respuesta como snapshot
  "después"). Retención sugerida: 2 años (alineado a lo esperado por DGII).
- **Plataforma** (`request.user.adminId` presente, sin `tenantId`): fila
  en `platform_audit_logs` (admin, acción, entidad, IP, "después") —
  cubre crear/suspender/actualizar tenants desde `/platform/tenants`.
  Consultable vía `GET /platform/audit-log` (paginado, con `busqueda`
  sobre `accion`/`entidad`; protegido con `PlatformAuthGuard`, igual que
  el resto de `/platform/**`).

`platform_audit_logs.adminId` es `onDelete: SetNull` — si se borra un
`PlatformAdmin` (p. ej. en la limpieza de un e2e), sus filas de auditoría
pasada quedan con `adminId: null` en vez de desaparecer.

## Auth de plataforma (super admin) vs. auth de tenant

Son dos sistemas completamente separados, sin puntos de cruce:

- **Tenant**: `JwtAuthGuard` + `PermissionsGuard`, secreto `JWT_SECRET`,
  payload con `tenantId`/`roles`/`permisos`. Protege todo por defecto
  (son `APP_GUARD` globales).
- **Plataforma**: `PlatformAuthGuard` (estrategia Passport `'jwt-platform'`
  separada), secreto `PLATFORM_JWT_SECRET`, payload con
  `adminId`/`email`/`permisos` — sin `tenantId`, porque un super admin no
  pertenece a ningún tenant. Cada controller de plataforma
  (`TenantsController`) lleva `@Public()` (para que el `JwtAuthGuard`
  global de tenants no intente validar el token con SU secreto y lo
  rechace) más `@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)`
  explícito (ver "RBAC de plataforma" abajo).

No hay alta del **primer** super admin por HTTP a propósito: se crea
desde el servidor con `pnpm --filter ./backend platform:bootstrap-admin`
(ver `backend/scripts/bootstrap-platform-admin.ts`), no vía endpoint —
es una operación de confianza total antes de que exista ningún admin.
Una vez que existe al menos uno con `platform.admins.gestionar`, sí puede
dar de alta admins adicionales por HTTP (`POST /platform/admins`).

## RBAC de plataforma

Mismo patrón conceptual que el RBAC de tenants (arriba), pero como
catálogo **global** (no por tenant, igual que `Modulo`/`Plan`):
`PlatformPermission`/`PlatformRole`/`PlatformRolePermission`
(`backend/prisma/schema.prisma`), sembrado con
`pnpm --filter ./backend platform-roles:seed` (catálogo en
`backend/src/platform-auth/platform-roles-base.ts`: roles **Super
Admin** (todos los permisos), **Ventas** (tenants + planes de solo
lectura/creación), **Soporte** (solo lectura + auditoría)).
`PlatformAdmin.roleId` es nullable — sin rol asignado, el guard deniega
cualquier ruta que pida un permiso puntual (mismo fallback seguro que
`Tenant.planId` nulo en `ModuloActivoGuard`).

`@PlatformPermissions('platform.tenants.crear')`
(`backend/src/common/decorators/platform-permissions.decorator.ts`) +
`PlatformPermissionsGuard`
(`backend/src/common/guards/platform-permissions.guard.ts`) validan por
request, mismas semánticas AND (`.every(...)`) que `PermissionsGuard` de
tenants.

**`PlatformPermissionsGuard` NO se registra globalmente vía `APP_GUARD`**
(a diferencia de `ModuloActivoGuard`/`PermissionsGuard` de tenants) —
esto se intentó primero y se revirtió tras encontrarlo roto en e2e (todas
las rutas de plataforma devolvían 403 incluso para el Super Admin): Nest
ejecuta los guards globales ANTES que los `@UseGuards()` de controller, y
`PlatformAuthGuard` (el que realmente puebla `request.user` con el
payload decodificado) es de controller, no global — un
`PlatformPermissionsGuard` global correría primero y encontraría
`request.user` siempre vacío. La diferencia con el lado tenant es que ahí
`JwtAuthGuard` (el que puebla `request.user`) SÍ es global y corre antes
que `PermissionsGuard` en la misma cadena; en plataforma no hay
equivalente global. Solución: aplicar ambos guards juntos, en ese orden,
en cada controller de plataforma —
`@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)` — el orden del
arreglo garantiza que `PlatformAuthGuard` corra primero.

`PlatformAdminsRepository`/`PlatformRolesRepository`
(`backend/src/platform-admins/`) exponen la gestión vía
`POST/PATCH /platform/admins` y `POST/PATCH /platform/roles`. Un admin no
puede desactivarse a sí mismo (`PlatformAdminsService.actualizar` rechaza
con 400 si `id === adminAutenticadoId && activo === false`) — único
candado de auto-bloqueo que vale la pena, sin construir un sistema de
"último admin con acceso total".

## Login en dos pasos (identificar la empresa)

`POST /auth/login` (`LoginDto`) sigue exigiendo `tenantSubdominio`
explícito — eso no cambió, sigue siendo la única forma real de resolver
qué tenant usar. Lo que cambió es que el usuario ya no tiene que saber
ese subdominio de memoria: `POST /auth/resolver-empresas` (público,
`AuthService.resolverEmpresas`) recibe solo un `email` y devuelve
`{ empresas: [{ subdominio, nombre }] }` — todos los tenants ACTIVOS
donde ese email tiene un `User` activo. El frontend (`Login.tsx`) llama
primero a este endpoint: si hay una sola empresa, la resuelve
automáticamente y solo pide la contraseña; si hay varias (mismo email en
más de un tenant, posible porque `User` es único por `(tenantId, email)`
y no globalmente), muestra un selector; si no hay ninguna, avisa sin
pasar a pedir contraseña.

A diferencia de `password/olvide` (que responde siempre el mismo mensaje
genérico para no filtrar qué correos existen), acá **sí se revela a
propósito** el nombre de la empresa para un email dado — es el objetivo
mismo del endpoint. Por eso está limitado con `@Throttle` (10
solicitudes/15 min) para no habilitar enumeración masiva, mismo mecanismo
que ya usa `password/olvide`, con un límite más laxo porque es parte del
flujo normal de login (tolera reintentos por typos).

`AuthService.login()` también devuelve ahora `usuario.tenant.{subdominio,
nombre}` (antes solo iba en el login inicial) — así el nombre de la
empresa activa queda visible de forma persistente en el sidebar, no solo
durante el login.

## Recuperación de contraseña

Dos flujos idénticos en forma, completamente separados (tenant vs.
plataforma), en `AuthService`/`PlatformAuthService`
(`backend/src/common/utils/password-reset-token.ts` tiene la parte común):

1. `POST .../password/olvide` genera un token aleatorio de 32 bytes
   (`crypto.randomBytes`), guarda solo su **hash SHA-256**
   (`resetPasswordTokenHash`) + expiración a 1 hora
   (`resetPasswordExpiraEn`), y envía por `EmailChannel` un link con el
   token en claro (`FRONTEND_URL` + `/restablecer-password?token=...`).
   Responde el **mismo mensaje genérico exista o no el email/tenant**,
   para no filtrar qué correos están registrados. Limitado a 5
   solicitudes/hora por IP+ruta (`@Throttle`) para no poder usarse como
   vector de spam de correos.
2. `POST .../password/restablecer` hashea el token recibido y busca un
   usuario/admin con ese hash y `resetPasswordExpiraEn > now()`. Si hay
   match, actualiza `passwordHash` y **limpia** los campos de reset — el
   token es de un solo uso. Si no hay match (vencido, ya usado, o
   inventado), 400.

Se hashea con SHA-256 y no con bcrypt porque el "secreto" acá es la
aleatoriedad del token (256 bits), no una contraseña de baja entropía
elegida por un humano — bcrypt sería solo costo computacional
desperdiciado. El hash en la tabla sirve únicamente para que un dump de
la base no exponga tokens válidos.

En dev, `EMAIL_HABILITADO`/`SMTP_HOST` normalmente no apuntan a un SMTP
real, así que el correo falla silenciosamente (se loguea el error) — el
link también se loguea a nivel `debug` en el propio servicio
(`Enlace de restablecimiento para ...`) para poder probar el flujo sin
un SMTP configurado. **Ese log es solo para desarrollo**: en producción,
con `EMAIL_HABILITADO=true` y SMTP real, es el único lugar donde el
token en claro existe fuera de la memoria del proceso.
