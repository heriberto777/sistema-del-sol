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

**Módulo propio de Notas** (Fase 4a de adopción de Cuadre,
`frontend/src/pages/NotasCredito.tsx`, ruta `/notas-credito`): antes
`EmitirNotaForm` solo existía como modal colgado de la pantalla de
Facturación, sin listado dedicado. Nada nuevo del lado de negocio —
reusa el mismo `EmitirNotaForm` y el mismo `FacturasTable`, que ganó un
prop `tiposFactura?` para filtrar el listado (`['NOTA_CREDITO',
'NOTA_DEBITO']` acá). El filtro real vive en
`GET /facturas?tipoFactura=...` (repetible en el query string,
`ListarFacturasQueryDto`, `FacturacionRepository.listar` arma
`{ tipoFactura: { in: [...] } }`) — el listado normal de Facturación
sigue sin mandar el parámetro, así que no cambia en nada.

## Ofertas — motor de descuentos automáticos (Fase 4b de adopción de Cuadre)

`backend/src/ofertas/` (`Oferta`, tenant-scoped) es un catálogo de
descuentos automáticos que se resuelven al facturar/cotizar — tres
alcances: `PRODUCTO` (un producto puntual), `CATEGORIA` (todos los
productos de una categoría) y `CARRITO` (sobre el subtotal completo de
la venta, con `montoMinimoCarrito` opcional). `productoId`/
`categoriaId`/`montoMinimoCarrito` son mutuamente exclusivos según
`alcance` — validado en `OfertasService.validarAlcance` (el schema no
lo puede exigir, son todas columnas nullable), mismo criterio que
`ProductosService.validarComponentes` para las reglas de COMBO.

**No acumulable — decisión explícita del usuario**: si una línea
matchea más de una oferta (ej. una de su producto y otra de su
categoría), se aplica la de MAYOR descuento resultante, nunca la suma
de ambas (`OfertasService.resolverDescuentoLinea`, `Math.max` sobre
los descuentos de todas las ofertas vigentes que matchean). Mismo
criterio para ofertas de `CARRITO`: si varias aplican a la vez, gana
la de mayor descuento, no se suman.

**Solo aplica a ventas nuevas** (`CONTADO`/`CREDITO`) — nunca a
`NOTA_CREDITO`/`NOTA_DEBITO`, que ajustan un monto YA facturado, no
calculan una venta fresca (`FacturacionService.crear`, guardia
`esVentaNormal`). Un descuento manual explícito en la línea (`linea.
descuento`, aunque sea `0`) siempre gana sobre el automático — nunca
se resuelve `OfertasService.resolverDescuentoLinea` si el caller ya
mandó un valor.

**Dos puntos de conexión** (decisión explícita del usuario — las
ofertas deben verse reflejadas antes de facturar, no solo al momento
de vender): `FacturacionService.crear()` (con lo cual `PosService` y
la conversión de Cotización→Factura lo heredan gratis, sin tocarlos)
y `CotizacionesService.calcularLineas()` — una cotización ya muestra
el precio con descuento. Remisiones NO lo necesita: `LineaRemision` no
tiene `precioUnitario` ni `descuento` en su modelo (documento sin
efecto fiscal, solo cantidades — ver "Cotizaciones y Remisiones" más
abajo).

**Descuento de carrito y prorrateo de ITBIS**: un descuento de
`CARRITO` no puede aplicarse como un número suelto al total — para que
el ITBIS de cada línea siga siendo correcto, `OfertasService.
resolverDescuentoCarritoTotal()` devuelve el monto total a descontar
(ya evaluado contra `montoMinimoCarrito`), y `prorratearDescuentoCarrito()`
(`backend/src/ofertas/prorratear-descuento-carrito.ts`, función pura
sin acceso a DB, testeada sin mocks) lo reparte proporcionalmente al
monto de cada línea (después de su propio descuento automático de
línea, si tuviera uno) — cada `FacturacionService.crear()`/
`CotizacionesService.calcularLineas()` suma ese extra al `descuento` de
la línea y recalcula `montoItbis`/`montoTotal` antes de sumar los
totales finales.

`ofertas.ver`/`ofertas.editar` son permisos nuevos en `PERMISOS_BASE`
— como con cualquier permiso agregado después de que un tenant ya fue
provisionado, no llega solo a tenants existentes (ver nota en
`backfill-permisos.ts`); correr `pnpm --filter ./backend
permisos:backfill` una vez.

**Limitación conocida — el POS no previsualiza el descuento antes de
cobrar**: `TurnoCajaDetalle` (POS) calcula "Total a cobrar"/"Pendiente"
en el navegador a partir del carrito, sin conocer las ofertas que el
backend va a resolver recién dentro de `FacturacionService.crear()`. Si
el cajero completa el pago exacto según el total SIN descontar, la
venta explota con el `BadRequestException` existente "La suma de los
pagos... no coincide con el total de la venta" en cuanto haya una
oferta vigente que aplique al carrito — no hay ningún endpoint de
"cotizar antes de cobrar" que el POS pueda consultar para mostrar el
total ya descontado antes de que el cajero arme los pagos. Pendiente de
decisión: un endpoint de previsualización, o restringir dónde aplican
las ofertas.

## Bonos — gift cards canjeables como forma de pago (Fase 4c de adopción de Cuadre)

`backend/src/bonos/` (`Bono`, tenant-scoped) son gift cards emitidas en
lote (`POST /bonos/lotes`, hasta 500 por lote,
`EmitirLoteBonosDto.cantidad/montoPorBono/fechaVencimiento`) con código
generado (`generarCodigoBono()`, `BONO-` + 8 caracteres sin
ambigüedad O/0/I/1) y vencimiento configurable por lote — decisión
explícita del usuario, contra la alternativa más simple de "sin
vencimiento".

**Sin tabla de movimientos propia**: `Bono.saldoActual` es la única
fuente de verdad, descontada atómicamente dentro de la MISMA
transacción de la venta que lo canjea. El propio `PagoVenta` (filtrado
por `formaPago.esBono` + `referencia = código`) ya sirve como libro de
canjes — mismo criterio que `MovimientoInventario`/`LineaAsiento` como
libros canónicos en vez de tablas redundantes.

**Reusa el catálogo de `FormaPago` en vez de inventar schema nuevo**:
`FormaPago.esBono: Boolean` sigue el mismo patrón que `esEfectivo` —
identifica la forma de pago programáticamente sin comparar por
`nombre`. Ya existía una forma de pago puramente informativa ("Nota de
Crédito", sin validación real detrás); Bono es la primera con
validación de negocio y efecto secundario real (descuento de saldo) al
canjearse. Un tenant existente puede autoservirse la forma "Bono" desde
`FormasPagoPanel` (checkbox "Es canje de Bono...") — no hace falta
backfill para esto, a diferencia de los permisos nuevos.

**Punto de conexión — `FacturacionService.crear()`**: dentro de la
misma transacción de la venta, ANTES de descontar inventario (fail
fast), se recorre cada pago resuelto y se llama
`BonosService.procesarPagoEnTx(tx, tenantId, pago)`, que es un no-op
si `formaPago.esBono` es `false`. Si es un canje de Bono, valida en
orden: viene `referencia` (código) → existe el código → no está
`ANULADO` → no está vencido (por fecha, aunque el estado en la fila
todavía diga `ACTIVO` — cubre la ventana antes de que corra el cron
diario) → el saldo alcanza (con el mismo `EPSILON = 0.005` que
`PagosService`/`PagosPlataformaService`). Si pasa todo, descuenta el
saldo y deja el bono en `AGOTADO` si llegó a cero, o `ACTIVO` si le
queda remanente. `BonosRepository.buscarPorCodigoEnTx`/
`descontarSaldoEnTx` reciben y reusan el mismo `tx` que abrió
`FacturacionService.crear()` — igual que con `InventarioService.
validarPertenencia`, si se usara el cliente top-level en vez del `tx`
recibido, RLS bloquearía la query en otra conexión sin el `SET LOCAL`
de esa transacción.

`BonosCronService` (`@Cron(CronExpression.EVERY_DAY_AT_8AM)`, patrón
igual a `RecordatoriosService`) marca `VENCIDO` los bonos cuya
`fechaVencimiento` ya pasó, vía `BonosRepository.marcarVencidosGlobal`
con el `PrismaService` global (no `TenantPrismaService`) — corre fuera
de cualquier request/tenant, mismo criterio que el resto de los crons.

`bonos.ver`/`bonos.editar` son permisos nuevos en `PERMISOS_BASE` —
igual que con `ofertas.*`, no llegan solo a tenants existentes; correr
`pnpm --filter ./backend permisos:backfill`. `bonos.ver` se otorga
también a Cajero/Supervisor de Caja (necesitan poder ver el catálogo al
cobrar), `bonos.editar` queda solo para Admin Total/Gerente.

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

## Categorías de productos (jerarquía real, Fase 3a de adopción de Cuadre)

`Categoria` (`backend/src/categorias/`) reemplaza el antiguo
`Producto.categoria` de texto libre por un catálogo tenant-scoped con
jerarquía real: `categoriaPadreId` es una self-relation
(`@relation("JerarquiaCategoria")`) — mismo patrón ya presente pero sin
explotar en `CuentaContable.cuentaPadreId`/`subcuentas`
(`@relation("JerarquiaCuenta")`), no un esquema de prefijos de código.
`Producto.categoriaId` (`onDelete: SetNull`) apunta a ella.

`GET /categorias` sirve el listado plano (con `categoriaPadreId`); el
árbol se arma en el cliente (`frontend/src/lib/categorias-arbol.ts`,
`aplanarArbolCategorias()`, depth-first con `profundidad` calculada) para
pintar `<select>`/chips indentados sin construir un árbol de verdad en
el DOM — reusado por `SelectCategoria` (formularios de Productos/
Categorías), `CategoriasPanel` (admin) y `CatalogoProductosPos` (chips
del POS).

`categoriaPadreId` es una FK cliente-suministrable a una tabla
tenant-scoped: `CategoriasService.crear()`/`actualizar()` la validan vía
`CategoriasRepository.buscarPorId()` (auto-scoped por
`TenantPrismaService`, 404 cross-tenant) antes de usarla, mismo patrón
que cualquier otra FK de este tipo en el proyecto (ver
`ProductosService` para `categoriaId`). `actualizar()` además rechaza
auto-referencia directa y ciclos: `validarNoEsDescendiente` recorre
hacia arriba la cadena de padres del candidato hasta encontrar la
categoría que se está editando (rechazo) o la raíz (válido) — es la
única lógica de prevención de ciclos en un árbol auto-referenciado que
existe hoy en el proyecto (el equivalente en `CuentaContable` nunca se
llegó a necesitar porque nada arma su jerarquía en código todavía).
Eliminar una categoría con productos o subcategorías asignadas se
rechaza (400), sin cascada silenciosa.

El filtro por categoría (`GET /productos?categoriaId=`, `GET
/productos/catalogo?categoriaId=`, chips del POS) es siempre exacto —
no incluye descendientes. Decisión deliberada para no over-engineering
esta sub-fase: filtrar por "Bebidas" no trae los productos de su hija
"Gaseosas" a menos que se seleccione "Gaseosas" directamente.

## Precios multinivel (Fase 3b de adopción de Cuadre)

`Precio.listaPrecio` ya era un `String` libre con índice (default
`"GENERAL"`) — el modelo ya soportaba múltiples listas por producto sin
migración de esa tabla. Lo que faltaba era de dónde sale la lista
aplicable a cada venta, sin quedar hardcodeada. `ListaPrecio` (tenant-scoped,
`backend/src/listas-precio/`, mismo patrón CRUD que `FormaPago` — sin
endpoint de borrado, solo activar/desactivar) es un catálogo de UI, **sin
FK real desde `Precio.listaPrecio`**: sirve para poblar selectores
(formulario de Precio en Productos, `Cliente.listaPrecioId`, el override
manual al facturar) y debe usar exactamente los mismos strings que ya
circulan como `listaPrecio` en `Precio` — empezando por `"GENERAL"`, que
sigue siendo el default hardcodeado del schema y de varios services.
Cambiar esa relación a una FK real habría exigido migrar/validar todo el
histórico de `Precio` ya escrito con ese string, para una tabla que hoy
está en uso — se optó por el catálogo desacoplado (mínimo cambio posible
sobre una tabla ya viva). `ListasPrecioService.actualizar()` rechaza
renombrar la fila `"GENERAL"` (400) por esta misma razón: haría
inalcanzables desde el catálogo los precios ya creados con ese nombre.

Resolución del nivel de precio, con override manual (requisito explícito
del usuario: "si al momento se puede asignar un precio diferente, se
puede?"): `Cliente.listaPrecioId` (`onDelete: SetNull`) fija el nivel por
defecto de un cliente. `FacturacionService.crear()`/`CotizacionesService.
crear()` resuelven `dto.listaPrecio ?? cliente.listaPrecio?.nombre ??
'GENERAL'` — el override explícito del DTO siempre gana sobre el default
del cliente, que a su vez gana sobre `"GENERAL"`. El override por venta
convive sin conflicto con el override por línea ya existente
(`LineaFacturaDto.precioUnitario`): la lista resuelve el precio de
catálogo cuando la línea NO trae un `precioUnitario` explícito, nunca al
revés. `PosService.registrarVenta`/`RegistrarVentaPosDto.listaPrecio`
exponen el mismo override en el checkout del POS. `CotizacionesService.
convertirEnFactura()` no participa de esta resolución: siempre manda
`precioUnitario` explícito por línea (el ya congelado al crear la
cotización), así que el nivel de precio es irrelevante en ese paso.

Como efecto colateral de resolver el cliente en `FacturacionService.
crear()`/`CotizacionesService.crear()` (`clientesService.buscarPorId(dto.
clienteId)`, tenant-scoped vía `TenantPrismaService`), ambos services
ahora también 404 si `clienteId` pertenece a otro tenant — antes de esta
fase no había ninguna validación de tenant sobre esa FK en particular.

**Fuera de alcance a propósito**: `ProductosRepository.catalogo()` (la
grilla visual del POS) sigue mostrando siempre el precio `GENERAL` como
referencia de navegación — resolver la lista multi-nivel ahí habría
significado re-resolver precio por cliente en cada tecla de búsqueda,
para una grilla que es solo apoyo visual (el precio real correcto se
resuelve recién al facturar, con el mecanismo de arriba).

## Atributos y variantes de producto (Fase 3c de adopción de Cuadre)

`Stock`/`Precio` ya no cuelgan directo de `Producto` — cuelgan de
`VarianteProducto` (nuevo modelo tenant-scoped, `variantes_producto`).
`MovimientoInventario` conserva su `productoId` (denormalizado, de solo
lectura, para no romper reportes que ya filtran por él) y gana
`varianteId` como FK real. Todo producto tiene siempre **al menos una
variante** — la "por defecto", sin `ValorAtributoVariante` asociados —
para que un producto que nunca usó atributos reales (Talla/Color) siga
teniendo exactamente una fila de stock/precio, igual que antes de esta
fase. `VarianteProducto` tiene `tenantId` propio (a diferencia de
`LineaFactura`/`PagoVenta`, hijas sin tenantId): se va a consultar
directo muy seguido (Stock, catálogo del POS, código de barras — Fase
3d) y necesita `@@unique([tenantId, codigoBarras])` sin depender de un
join a `Producto`.

### Incremento 1: schema

Migración (`20260819100000_variantes_producto`): crea las 4 tablas
nuevas (`variantes_producto`, `atributos`, `valores_atributo`,
`valores_atributo_variante`), siembra una variante "por defecto" por
cada `Producto` existente, agrega `varianteId` NULLABLE a
`precios`/`stock`/`movimiento_inventario`, migra los datos usando el
`productoId` todavía presente en esas tres tablas, y solo entonces
borra `precios.productoId`/`stock.productoId` (con sus constraints
viejas) y endurece `varianteId` a `NOT NULL` en las tres.

**Este incremento es solo schema + la plomería mínima de repositorio
para que nada se rompa — cero cambios en la capa de servicio.** Como
todo producto tiene exactamente una variante hasta el incremento 2 (que
recién habilita atributos/variantes reales), cada repositorio que tocaba
`Stock`/`Precio` gana un paso de resolución `productoId → variante
"por defecto"` (`VarianteProducto.findFirst({where:{productoId},
orderBy:{createdAt:'asc'}})`, o su variante `EnTx` cuando el caller ya
abrió una transacción) y sigue exponiendo el mismo parámetro
`productoId`/la misma forma de retorno que antes — así
`FacturacionService`, `CotizacionesService`, `PosService`,
`ComprasService` y `ProductosService` no cambian ni una línea:
- `InventarioRepository` (obtenerStock, listarStockPorBodega,
  ajustarCantidadEnTx, descontarStockCondicionalEnTx — incluida la
  única query SQL cruda del proyecto que tocaba `stock` directo).
- `PreciosRepository` (vigente, historial, crear).
- `FacturacionRepository`/`CotizacionesRepository.
  obtenerProductoConPrecioVigente` y `ProductosRepository.catalogo()`:
  la nested-select de `precios` ahora va vía `variantes` y se
  **reaplana** al shape viejo (`{...producto, precios: variantes[0]?.
  precios ?? []}`) antes de devolver, para que el caller siga leyendo
  `producto.precios[0]?.precioVenta` sin saber que por debajo hay una
  variante de por medio.
- `ReportesRepository` (stockBajoConteo, stockActual): mismo criterio,
  reaplana `variante.producto` a `producto` en cada fila.

### Incremento 2: CRUD de atributos/variantes + generación de combinaciones

`AtributosModule` (`backend/src/atributos/`) es el catálogo tenant-scoped
de atributos (`POST/GET /atributos`) y sus valores (`POST /atributos/
:id/valores`, `DELETE /atributos/:id/valores/:valorId`, `DELETE
/atributos/:id`). `ValorAtributo` es una tabla "hija" sin tenantId
propio (mismo patrón que `ComponenteCombo`) — su aislamiento depende de
validar primero el `Atributo` padre (tenant-scoped) y recién ahí
confirmar que el valor realmente pertenece a ESE atributo, antes de
tocarlo (`AtributosService.eliminarValor`). Eliminar un valor o un
atributo con algún valor en uso por una variante real se rechaza (400)
— igual criterio que `Categoria`/`ListaPrecio`.

`VariantesModule` (`backend/src/variantes/`) genera el producto
cartesiano de los valores elegidos por atributo — una
`VarianteProducto` por combinación — vía `VariantesService.
generarCombinaciones(productoId, tenantId, seleccion)`, invocado desde
`ProductosService.actualizar()` cuando el `PATCH` trae el campo
`atributos` (ausente = no tocar variantes; `[]` = revertir a una única
variante "por defecto" sin atributos). Mismo patrón "borrar todo y
recrear" que `ComponenteCombo` ya usa para combos: se borran TODAS las
variantes actuales del producto y se crean las nuevas dentro de una
transacción. Antes de borrar, valida dos cosas:
- Cada `valorId` elegido realmente pertenece al `atributoId` indicado
  (400 si no) — mismo espíritu que el resto de FKs cliente-suministradas.
- **Ninguna de las variantes actuales tiene movimientos de inventario
  registrados** (`MovimientoInventario.varianteId` es `RESTRICT`, no
  `Cascade`, a propósito — ver el modelo) — si los tiene, rechaza (400)
  en vez de dejar que el `DELETE` explote con una violación de FK cruda.
  Esto significa que **regenerar variantes reales solo es posible antes
  de la primera venta/movimiento de stock del producto** — una
  limitación real y deliberada: Precio/Stock si cuelgan con `Cascade` y
  se pierden silenciosamente al regenerar (aceptable, porque en ese
  punto no hay historial de movimientos que perder), pero el
  movimiento de inventario si existiera se perdería de verdad, y eso sí
  se bloquea. Un tope de 400 combinaciones (`MAX_COMBINACIONES` en
  `variantes.service.ts`) es solo un salvavidas contra una combinatoria
  descontrolada (varios atributos con muchos valores cada uno), no un
  límite de negocio.

`ProductosRepository.crear()` ahora también crea la variante "por
defecto" del producto nuevo en la misma transacción — un gap real que
el incremento 1 había dejado abierto (todo producto creado *antes* de
esa migración tenía su variante por el backfill, pero nada creaba una
para los productos *nuevos* hasta este incremento; se detectó y corrigió
acá, verificado manualmente contra la base real: crear un producto,
asignarle un precio, y confirmar que resuelve sin 404).

`GET /productos/:productoId/variantes` (`VariantesController`) expone
el listado de variantes de un producto con sus valores de atributo —
para el consumo de incrementos posteriores (selector de variante en
Facturación/POS, tabla de variantes en Productos.tsx).

### Incremento 3: líneas con `varianteId` explícito

Las líneas de venta/compra (`LineaFactura`, `LineaCotizacion`,
`LineaRemision`, `LineaOc`, `LineaRecepcion`, `LineaDevolucionCompra`,
`VentaAparcadaLinea`) ganan `varianteId` (migración
`20260819110000_lineas_variante`, `NOT NULL` + FK `RESTRICT` — perder a
qué variante corresponde una línea ya emitida/recibida sería perder
historial real). Backfill determinista: cada línea existente se asigna
a la variante más antigua de su producto (en ese momento todo producto
tiene como mucho una variante real, porque regenerar variantes ya
estaba bloqueado si el producto tenía movimientos — ver incremento 2).

`VariantesService.resolverObligatoria(productoId, varianteId?)` es el
único punto que decide qué variante usa una línea: si el producto tiene
una sola variante, se resuelve sola (el `varianteId` del DTO puede
omitirse — retrocompatible con todo lo que no usa atributos reales); si
tiene más de una, exige `varianteId` explícito (400 si falta) y valida
que esa variante realmente pertenezca a ese producto (mismo patrón de
IDOR ya documentado para FKs cliente-suministradas). `FacturacionService.
crear()`/`CotizacionesService.calcularLineas()`/`RemisionesService.
resolverLineas()`/`ComprasService.crear()`/`PosService.
guardarVenta()` resuelven la variante **una vez por línea** y reusan ese
mismo id tanto para el precio (`obtenerProductoConPrecioVigente(productoId,
varianteId, listaPrecio)`) como para el movimiento de stock
(`InventarioService.*(..., varianteId?)`, que a su vez llama
`resolverObligatoria` internamente si no le llega ya resuelto) — nunca
dos resoluciones independientes que podrían discrepar. `ComprasService.
recibir()`/`devolver()` NO piden `varianteId` de nuevo al cliente: lo
leen de la línea de la OC ya creada (mismo criterio que `costoUnitario`
en `devolver()` — se lee de la línea original, no se vuelve a preguntar).

Bug real encontrado por el e2e de atomicidad de Compras (`recibir con
una línea de producto inexistente...`) y corregido en este incremento:
`resolverObligatoria` no validaba el caso de **cero** variantes (un
`productoId` que no existe, o de otro tenant) — `variantes[0].id`
explotaba con un `TypeError` crudo (500) en vez de un 404 claro. Ahora
lanza `NotFoundException` en ese caso; el e2e correspondiente pasó de
esperar 409 (violación de FK cruda, el comportamiento viejo) a esperar
404 (validación limpia antes de tocar la base).

Verificado manualmente contra la base real: producto con dos variantes
reales (Talla S/M) rechaza facturarse sin `varianteId` ("tiene varias
variantes — indicá varianteId en la línea"), acepta con `varianteId`
explícito, y el descuento de stock queda aislado a esa variante (la
otra no se toca).

### Incremento 4: frontend

`SelectorLineaProducto` (`frontend/src/components/molecules/
SelectorLineaProducto/`) reemplaza el `<select>` de producto duplicado
en cada formulario de línea (Facturación/Cotizaciones/Remisiones/
Compras) por un componente que, además, resuelve la variante:
consulta `GET /productos/:id/variantes` al elegir producto y — si hay
más de una — muestra un segundo `<select>` de variante (etiquetado por
sus valores de atributo, ej. "Talla: M, Color: Azul"), obligatorio
antes de poder enviar la línea. Con una sola variante no se muestra
nada extra — se resuelve sola, igual que en el backend. `EmitirNotaForm`
(nota de crédito/débito) no necesita este selector: la variante ya
viene fija en la línea de la factura original, solo se propaga.
`ComprasService.recibir()`/`devolver()` tampoco: la variante se lee de
la línea de la OC ya creada, nunca se le vuelve a preguntar al usuario
(mismo criterio que `costoUnitario` en `devolver()`).

**POS** (`CatalogoProductosPos.tsx`): clic en una tarjeta con más de una
variante abre un modal para elegir cuál antes de agregar al carrito —
no hay forma de mostrar N variantes como N tarjetas distintas en la
grilla sin rehacer el catálogo completo, así que se resuelve al
momento del clic. El precio mostrado en la tarjeta de catálogo es el de
la variante "representativa" (ver el "fuera de alcance" documentado en
Precios multinivel) — al elegir la variante real en el modal, se
resuelve su precio específico (`GET /precios/:productoId?varianteId=`)
antes de agregarla al carrito, para no cobrar el precio de una variante
distinta a la elegida (bug real, encontrado y corregido en este
incremento: antes se arrastraba el precio de la tarjeta sin re-resolver).

**Precios por variante**: `PreciosService`/`PreciosRepository`/
`CrearPrecioDto` ganan `varianteId` (mismo criterio `resolverObligatoria`
que el resto) — antes de este incremento, `POST /precios` siempre
resolvía "la variante más antigua del producto" sin importar cuántas
variantes reales tuviera, así que no había forma de asignarle un precio
distinto a cada Talla/Color (gap real, encontrado y corregido en este
incremento). `FormularioPrecio` (Productos.tsx) gana el mismo selector
de variante condicional; la celda "Precio vigente" del listado general
muestra "Varias variantes" en vez de "—" cuando el producto tiene más
de una (mostrar "—" ahí sería indistinguible de "sin precio").

**Atributos y armado de variantes** (`Productos.tsx`): nuevo
`AtributosPanel` (Admin → Catálogo → Atributos) para el CRUD de
`Atributo`/`ValorAtributo`. `VariantesProductoPanel`, embebido en el
formulario de producto (solo tipo `PRODUCTO`, solo editando uno ya
creado — `ProductosService.actualizar()` es el único que dispara la
regeneración), deja elegir qué valores de cada atributo aplican, arma
el producto cartesiano en el cliente para mostrar cuántas variantes se
generarían, y llama `PATCH /productos/:id` con `atributos: [...]` al
confirmar. Precarga la selección desde las variantes ya existentes del
producto para no perderla al reabrir el formulario.

**Inventario** (`Inventario.tsx`): la pantalla de Stock por bodega pasa
a operar por variante — cada fila ya trae `varianteId` y
`valoresAtributo` (ver arriba, `listarStockPorBodega`), se muestra el
valor de atributo junto al nombre del producto cuando aplica, y
Ajustar/Transferir stock envían el `varianteId` de esa fila específica
en vez de asumir "la variante por defecto del producto" (que ya no
existe como concepto único una vez que el producto tiene variantes
reales).

Dos bugs reales encontrados por verificación manual en este incremento
(ninguno cubierto por los tests automatizados, que no ejercitan la UI):
un `reduce` multiplicativo con acumulador inicial `0` en vez de `1` en
`VariantesProductoPanel` (mostraba "0 variantes" sin importar la
selección), y el precio-de-tarjeta-sin-re-resolver del POS descrito
arriba.

### Código de barras (Fase 3d)

`VarianteProducto.codigoBarras`/`sku` ya existían en el schema desde el
incremento 1 (`@@unique([tenantId, codigoBarras])`), sin usarse en
ningún lado hasta esta sub-fase. `VariantesService.actualizarCodigoBarras`
(`PATCH /productos/:productoId/variantes/:varianteId`) los completa:
valida que la variante realmente pertenezca a `productoId` (mismo
patrón de IDOR que `resolverObligatoria`) antes de escribir; `null`
explícito quita el código asignado.

`ProductosRepository.whereBusqueda()` extiende su `OR` para matchear
también `variantes.some.codigoBarras` — un lector de código de barras
USB (emula teclado + Enter, sin integración especial) ya funciona tal
cual contra el buscador existente de catálogo/POS, sin ningún endpoint
ni modo especial nuevo.

**Impresión de etiquetas es 100% client-side** (`frontend/src/lib/
etiquetas-codigo-barras.ts`, dependencia `jsbarcode`) — mismo criterio
que el ticket térmico del backend (`documento-ticket.ts`): arma un
documento HTML standalone con `window.onload = () => window.print()` y
lo abre con `abrirBlob()`, sin pasar por el servidor. La única
diferencia real es que acá el renderizado del barcode en sí (SVG) tiene
que ocurrir en el navegador — `JsBarcode()` puede dibujar sobre un
`<svg>` creado con `document.createElementNS` sin insertarlo en el DOM
real; se serializa con `.outerHTML` y se concatena directo en el HTML
de salida, junto al nombre del producto y la etiqueta de la variante
(escapados a mano, mismo `escaparHtml` que ya usa el ticket térmico —
nombre de producto es texto influenciable por el usuario final). Solo
se ofrecen para imprimir las variantes que ya tienen `codigoBarras`
asignado. `jsbarcode` no trae sus propios tipos en el paquete (no
declara `types`/`typings` en su `package.json`) — se instaló
`@types/jsbarcode` aparte como devDependency.

## Import/export de catálogo por Excel (Fase 3e)

**Export** (`GET /productos/exportar`, `ProductosService.exportar()`)
reusa `generarExcel()` (`backend/src/reportes/exportadores/
excel-exportador.ts`), el mismo helper que ya usa `ReportesService` —
sin exportador nuevo. `ProductosRepository.exportarDatos()` trae TODAS
las variantes de cada producto (no solo la "por defecto" como
`catalogo()`): el precio GENERAL de la columna sigue el mismo criterio
de "variante representativa" (la más antigua) que `catalogo()`, pero
código de barras y stock se agregan sobre TODAS las variantes (join de
códigos de barras con `, `, suma de stock de todas las bodegas de todas
las variantes) — reflejar el catálogo completo en un export importa más
que mantener la misma simplificación que la grilla del POS.

**Import** (`POST /productos/importar`,
`ProductosService.importar()`/`importarFila()`) deliberadamente **no
usa `multer`** — sigue la misma filosofía 100% client-side que
`CampoImagen` (comprime y manda base64 en JSON, nunca multipart): el
`.xlsx` se parsea y valida ENTERO en el navegador
(`frontend/src/lib/importar-productos-excel.ts`, con ExcelJS también —
ver más abajo) antes de mandar nada; recién al confirmar se envía el
arreglo ya validado como JSON plano. Upsert por código
(`ProductosRepository.buscarPorCodigo`), **fila por fila, sin
transacción cruzada entre filas** — cada fila se procesa de forma
independiente y un error en una no aborta las demás (`try/catch` por
fila dentro de `importar()`), por eso el resumen es
`{ creados, actualizados, errores }` en vez de todo-o-nada. Si la
categoría indicada (por nombre) no existe, se crea a nivel raíz
(`CategoriasRepository.buscarPorNombre` + `crear`) — más amigable para
una carga masiva que rechazar la fila por un nombre no precreado.

Deliberadamente **fuera de alcance** (documentado, no un gap
accidental): productos `COMBO` (sin forma razonable de expresar
`componentes` en una fila plana — la validación del DTO ya rechaza
`tipo` fuera de `PRODUCTO`/`SERVICIO`), variantes reales de Talla/Color
(precio/código de barras de una fila importada siempre se aplican a la
variante "por defecto" vía `VariantesService.resolverObligatoria` sin
`varianteId` — si el producto YA tiene variantes reales de una edición
anterior por la UI, esa llamada explota con 400 y la fila queda en
`errores`, aunque el nombre/categoría/código ya se hayan actualizado
con éxito: comportamiento correcto, no un bug, ver el comentario en
`ProductosService.importarFila`), y stock (se gestiona vía Inventario,
nunca sobreescribiéndolo desde un catálogo). Cuando la fila trae
`precioGeneral`, se crea un `Precio` con `costo = precioVenta` (margen
0%) vía `PreciosRepository` — sin desglose de costo/margen en una fila
plana, se refina después desde la pantalla de Precios si hace falta.

`PreciosRepository` se provee directo en `ProductosModule` (no
importando `PreciosModule`) para que `ProductosService` pueda crear ese
`Precio` sin ciclo de módulos: `PreciosModule` ya importa
`ProductosModule` (para `PreciosService`), así que lo inverso
(`ProductosModule` importando `PreciosModule`) sería circular.
`PreciosRepository` no depende de nada de Productos, así que darle su
propia instancia en `ProductosModule.providers` es seguro (dos módulos
proveyendo la misma clase, cada uno con su propia instancia stateless
salvo por `TenantPrismaService`, ya request-scoped).

**El parseo del `.xlsx` en el navegador usa ExcelJS, no `xlsx`/SheetJS**
(la dependencia que suele mencionarse por defecto para esto): la
versión de `xlsx` publicada en el registro de npm (0.18.5) tiene
vulnerabilidades conocidas (prototype pollution, ReDoS) sin parche ahí
— SheetJS solo publica versiones arregladas en su propio CDN, no en
npm. ExcelJS ya está vetado en el proyecto (lo usa el backend para
reportes) y no tiene ese historial, así que se reusó en vez de sumar
una dependencia nueva con ese riesgo. Import **dinámico**
(`await import('exceljs')`) en vez de import top-level — ExcelJS pesa
~1MB minificado y solo hace falta para quien realmente abre "Importar
Excel"; Vite lo separa en su propio chunk (`exceljs.min-*.js`), sin
inflar el bundle principal para todo el mundo.

`Modal` (`frontend/src/components/molecules/Modal/Modal.tsx`) ganó un
prop opcional `ancho?: 'lg' | 'xl'` (default `'lg'`, retrocompatible con
los ~25 usos existentes) para la vista previa de importación, que
necesita más espacio horizontal que un formulario normal.

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

**Plan de cuentas como árbol expandible** (Fase 6 de adopción de
Cuadre, `frontend/src/components/organisms/CuentasContablesTable/`):
100% frontend — `CuentaContable.cuentaPadreId`/`subcuentas`
(`@relation("JerarquiaCuenta")`) ya existía en el schema sin explotar
(mismo precedente que ya usó `Categoria`, ver arriba), y `GET
/contabilidad/cuentas` ya devolvía el campo (ningún `select` explícito
en el repositorio). `frontend/src/lib/cuentas-arbol.ts` arma el árbol
real (`construirArbolCuentas`, hijos anidados y ordenados por
`codigo` — no por nombre, convención contable) para el expand/collapse
por fila, y una versión aplanada con profundidad
(`aplanarArbolCuentas`) para el `<select>` de "Cuenta padre" del
formulario de alta — sin este selector, no había forma de construir la
jerarquía desde la UI. Todo expandido por defecto (nada queda oculto
sin que el usuario lo pida); `colapsadas` en el componente solo guarda
qué ids el usuario decidió plegar. Deliberadamente sin `PATCH` para
reasignar `cuentaPadreId` de una cuenta ya creada — cuentas nuevas
pueden anidarse desde el alta, pero reorganizar el catálogo base ya
sembrado queda fuera de esta fase.

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
- **`Factura.formaPagoId`/`Factura.turnoCajaId`** son nullable y
  **solo los llena una venta de POS** — el resto de la facturación
  (venta normal desde el módulo de Facturación, conversión de
  cotización/remisión) los deja `null`. `FacturacionService.crear()`
  acepta un tercer parámetro opcional (`{ formaPagoId, referenciaPago,
  turnoCajaId }`) para esto, sin tocar `CrearFacturaDto` (que sigue
  validando solo lo que la ruta HTTP de Facturación necesita).
- **`POST /pos/turnos/:id/movimientos`**: entradas/salidas de efectivo
  que NO son una venta (retiro para gasto menor, ingreso de vuelto
  adicional). Las ventas ya se contabilizan solas vía
  `Factura.turnoCajaId` — no generan una fila en `MovimientoCaja`.
- **`POST /pos/turnos/:id/cerrar`**: `montoEsperado = montoInicial +
  Σ(ventas cuya `FormaPago.esEfectivo` de este turno) + Σ(entradas) -
  Σ(salidas)`; `diferencia = montoFinalContado - montoEsperado`. Ventas
  con una forma de pago que no es efectivo (tarjeta/transferencia/etc.)
  no se cuentan en el efectivo esperado (ese dinero nunca pasó por la
  caja física).
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
"sin offline en v1"), pagos con tarjeta procesados de verdad (elegir la
forma de pago "Tarjeta" solo registra la intención, no integra una
pasarela), y pagos divididos (una venta usa una sola `FormaPago`, no
un mix efectivo+tarjeta en la misma factura). La impresión de tickets sí
está cubierta — ver la sección siguiente.

### Formas de pago (catálogo configurable, reemplaza el enum fijo)

`backend/src/formas-pago/` — antes `Factura.metodoPago`/`Pago.metodoPago`
eran un enum fijo (`EFECTIVO`/`TARJETA`/`TRANSFERENCIA`); ahora son
`FormaPago`, un catálogo **tenant-scoped** (`formas_pago`, sembrado con 6
valores por defecto en `TenantsRepository.crearConProvisioning` —
`FORMAS_PAGO_BASE`) que el admin edita desde `/admin` → Facturación →
"Formas de pago" (`FormasPagoPanel.tsx`). `MetodoPago` (el enum) se
mantiene en el schema **solo para `PagoPlataforma`** (facturación de la
plataforma a sus tenants, concepto no relacionado) — ver la sección de
Suscripción/facturación de plataforma en el `CLAUDE.md` raíz.

- **`esEfectivo`** marca cuál `FormaPago` cuenta como efectivo físico
  para el arqueo de POS — a lo sumo una por tenant. La exclusividad se
  aplica en el service (`FormasPagoService.crear()/actualizar()` llaman
  `FormasPagoRepository.desmarcarEfectivoDeOtras()` antes de escribir
  cuando `esEfectivo: true`), no con una constraint de DB.
- **`requiereReferencia`** es solo informativo para el frontend (mostrar
  un campo de referencia); el backend no lo valida al recibir
  `referencia`/`referenciaPago`.
- **`GET /formas-pago`** no tiene `@Permissions` a propósito — cualquier
  usuario autenticado que registre un cobro/venta (POS, Cobranza,
  Compras) necesita leer el catálogo, no solo quien lo administra.
  `POST`/`PATCH /formas-pago/:id` sí exigen `admin.configuracion`.
- **`formaPagoId` es una FK cliente-suministrada** — `PosService.
  registrarVenta()` y `PagosService.registrarPagoFactura()/
  registrarPagoOrdenCompra()` la validan con `FormasPagoRepository.
  buscarPorId()` (tenant-scoped, 404 si no pertenece al tenant) antes de
  usarla en cualquier `create`, siguiendo el mismo patrón de
  prevención de IDOR ya documentado para tablas hijas.
- **Migración de datos**: `20260819040000_formas_pago` sembró el
  catálogo para tenants ya existentes y migró cada `Factura`/`Pago` con
  `metodoPago` no nulo a la `FormaPago` equivalente por nombre, antes de
  dropear la columna del enum.

### UX del cajero: carrito, cliente por defecto, y anulación en el mismo flujo

`TurnoCajaDetalle.tsx` arma la venta como un carrito local (múltiples
líneas antes de cobrar, cada una pidiendo su precio vigente a
`GET /precios/:productoId`) y llama `POST /pos/ventas` una sola vez con
todo el arreglo — el backend ya soportaba `lineas[]`, así que esto es
puramente frontend. Cliente/Producto usan el nuevo
`ComboboxBusqueda` (`frontend/src/components/molecules/ComboboxBusqueda/`)
en vez del `<select>` nativo truncado a 100 registros, contra los
mismos endpoints paginados que ya existían (`/clientes?busqueda=`,
`/productos?busqueda=`).

**Cliente "Consumidor Final"**: cada tenant tiene un `Cliente` singleton
marcado `esConsumidorFinal: true` (sembrado en
`TenantsRepository.crearConProvisioning`, backfill en
`backend/scripts/backfill-consumidor-final.ts` para tenants previos),
resuelto vía `GET /clientes/consumidor-final` y precargado por defecto
al abrir el carrito de POS — el cajero puede cambiarlo a un cliente
real buscándolo. Se eligió esto en vez de volver `Factura.clienteId`
nullable para no tocar reportes/facturación que asumen un cliente
siempre presente.

**Anulación/devolución desde POS**: reutiliza `POST /facturas/:id/anular`
tal cual (mismo flujo que Facturación) — no hay endpoint ni lógica
nueva. El rol `Vendedor` ahora incluye `facturacion.anular` en
`ROLES_BASE` (antes solo lo tenían roles de supervisión), propagado a
tenants existentes con el `permisos:backfill` genérico. Una venta
anulada dentro de un turno abierto deja de contar en el efectivo
esperado del cierre porque `PosService.cerrarTurno` ya filtraba por
`estado: 'EMITIDA'`.

**Vendedor solo vende por POS — nunca por Facturación directa.** Antes
`Vendedor` también tenía `facturacion.crear/ver/cobrar`, así que veía
"Facturación" en el menú y podía cobrar una venta en efectivo ahí
mismo — una venta que **no queda amarrada a ningún turno** y por lo
tanto nunca entra al arqueo de caja (un hueco real de control de
efectivo, no solo de UX). Es el mismo patrón que separan Odoo/Lightspeed:
el cajero solo opera dentro de una sesión de caja, la app de
facturación/contabilidad de oficina es otra pantalla para otro rol.
Arreglado quitándole a `Vendedor` `facturacion.crear/ver/cobrar` — sin
`facturacion.ver` el ítem "Facturación" del sidebar (gateado en ese
mismo permiso) deja de aparecer solo, sin tocar `Sidebar.tsx`. Como
`GET /facturas/:id/pdf`/`/imprimir` (el botón "Imprimir recibo" dentro
del turno) también estaban gateados en `facturacion.ver`, se separó un
permiso nuevo **`facturacion.imprimir`** solo para esos dos endpoints —
`Vendedor` lo tiene sin `facturacion.ver`, y los roles que ya
imprimían/veían facturas (Admin Total, Gerente, Contador, Auditor)
lo suman para no perder esa capacidad. Migrar tenants ya provisionados
necesitó dos scripts: `permisos:backfill` (genérico, solo agrega lo que
falta) para sumar `facturacion.imprimir` donde corresponde, y un
one-off `ajustar-permisos-vendedor:migrar`
(`backend/scripts/ajustar-permisos-vendedor-pos.ts`) para quitarle a
`Vendedor` los tres permisos que ya no debe tener — el backfill genérico
es deliberadamente aditivo (nunca borra), así que remover un permiso de
`ROLES_BASE` siempre va a necesitar un script puntual como este.

**Aterrizaje directo en POS.** En Lightspeed/Square/Odoo el patrón no es
"recomendable" abrir turno, es un bloqueo duro — "sales can be recorded
only when a session is active" — y el login del cajero termina directo
en esa apertura, no en un dashboard genérico. `AuthContext.
usaPosComoInicio(usuario)` (`pos.editar` sin `facturacion.ver` — hoy la
firma de Cajero Y de Supervisor de Caja, ninguno de los dos tiene
`reportes.ver` así que el Dashboard les quedaría vacío) decide a dónde
manda `Login.tsx` al autenticarse. Dentro de `Pos.tsx`, un criterio más
angosto — `esCajeroPuro` (lo mismo, pero además SIN `pos.supervisar`) —
decide qué vista se muestra: un Cajero puro va a `PosCajero` (sin la
tabla de turnos de otros cajeros, no le sirve de nada); un Supervisor de
Caja o Admin/Gerente ve la `TurnosCajaTable` completa. Un Cajero puro
busca directo si YA tiene un turno `ABIERTO` propio (`GET /pos/turnos?
cajeroId=<yo>&estado=ABIERTO`) y si no, muestra solo el formulario de
apertura (`AbrirTurnoForm`, compartido con el modal de
`TurnosCajaTable` para no duplicar la lógica) — nunca una pantalla
vacía sin acción clara. Apenas hay un turno (recién abierto o ya
existente), tanto `PosCajero` como un supervisor que elige "Entrar a la
caja" navegan a `/pos/caja/:turnoId` (ver subsección siguiente) — ya no
se renderiza `TurnoCajaDetalle` embebido dentro de `AppLayout`.

### Pantalla completa + atajos de teclado (Fase 2a de adopción de Cuadre)

`/pos/caja/:turnoId` (`frontend/src/pages/PosCaja.tsx`) es una ruta
**hermana de `AppLayout`**, no una hija — mismo criterio que
`/pagar/:facturaId` (dentro de `RutaProtegida` para exigir sesión, pero
fuera del árbol que monta `Sidebar`/header general). Es la réplica del
modo dedicado de `pos.cuadre.do`: sin sidebar, header propio (cajero,
badge de estado, atajos visibles), y toda la lógica de carrito/turno
sigue viviendo en el mismo `TurnoCajaDetalle` de siempre — le agregamos
una prop `pantallaCompleta` que le quita su propio `<Card>` (para no
quedar en una caja dentro de otra caja) y activa los atajos de teclado.

**`useAtajosTeclado`** (`frontend/src/hooks/useAtajosTeclado.ts`): hook
genérico, un solo `addEventListener('keydown', ...)` a nivel de
`document` por instancia. Las teclas `F1-F12`/`Escape` no escriben
caracteres, así que se disparan aunque el foco esté en un `<input>` (el
cajero puede estar tipeando una búsqueda); cualquier otra tecla mapeada
se ignora con el foco en un campo de texto libre, para no interferir
con la escritura normal. Esta fase cablea F3 (foco al combobox de
cliente), F5 (refrescar), F6 (vaciar carrito), F7 (abrir Mov. Caja) y F9
(abrir Cerrar Caja) — F2/F4/F8/F10/F11/F12/⇧F12 se suman en las
sub-fases siguientes de esta misma Fase 2, reutilizando el mismo hook.

**Catálogo con categorías y cantidad rápida**: `categoria` de
`Producto` sigue siendo texto libre (no hay tabla `Categoria`) —
`GET /productos/categorias` (`ProductosController`, mismo permiso
`precios.ver` que `/productos/catalogo`) devuelve los valores distintos
no nulos del tenant, pintados como chips en `CatalogoProductosPos.tsx`.
Un input de cantidad junto al buscador permite fijar cuántas unidades
agrega el próximo clic (se resetea a 1 después de cada clic) — evita
tener que editar la cantidad línea por línea en el carrito para
compras de más de una unidad.

**`ComboboxBusqueda` con navegación por teclado**: se agregó
`ArrowUp`/`ArrowDown` para mover el resaltado, `Enter` para confirmar la
opción resaltada y `Escape` para cerrar — antes solo aceptaba clic de
mouse en cada resultado.

### Vendedor de la venta (Fase 2b — comisión, distinto del cajero)

En Cuadre el "Cajero" (quien opera la caja) y el "Vendedor" (a quien se
le acredita la venta para comisión) son personas distintas elegidas por
separado en cada venta. `Factura.vendedorId` ya existía pero apunta a
`User` (quien factura/cobra — el cajero); se agregó
**`Factura.vendedorEmpleadoId`** (nullable, → `Empleado`, `onDelete:
SetNull`) para el segundo concepto, sin tocar `vendedorId`.

**`Empleado.cargo` (texto libre de Nómina) no tiene ninguna relación con
`User`/roles del sistema** — son dos catálogos independientes. "Vendedor
de comisión" se resuelve como `Empleado` con
`cargo: { contains: 'Vendedor', mode: 'insensitive' }` (mismo criterio
laxo que ya usa `EmpleadosRepository.listar` para buscar por cargo). Un
vendedor de comisión **no necesita poder loguearse** — por eso se eligió
`Empleado` y no una segunda referencia a `User`.

**`GET /pos/vendedores`** vive en `PosModule` (que importa `NominaModule`
solo para inyectar `EmpleadosRepository`, sin exponer sus endpoints) y
**no exige `@RequiereModulo('nomina')` ni `nomina.ver`** — mismo criterio
que `GET /pos/cajeros`: un Cajero con solo `pos.ver` necesita elegir
vendedor sin que el tenant tenga el módulo Nómina activo. `PosService.
registrarVenta` valida `vendedorEmpleadoId` tenant-scoped (si viene) con
`EmpleadosRepository.buscarPorId` antes de pasarlo a
`FacturacionService.crear()`, mismo patrón que `formaPagoId`.

Frontend: `TurnoCajaDetalle.tsx` agrega un segundo `ComboboxBusqueda`
("Vendedor (opcional, para comisión)") junto al de Cliente, atado a F2.

### Descuento por línea (Fase 2c — 100% frontend, F8)

`LineaFactura.descuento` (monto flat por línea) ya existía en el schema
desde antes de esta fase — el backend no necesitó ningún cambio.
`ModalDescuento` (dentro de `TurnoCajaDetalle.tsx`) deja elegir
%/monto fijo y a qué líneas del carrito aplica; si es %, el frontend lo
convierte a monto flat (`cantidad * precioUnitario * pct / 100`) antes
de guardarlo en el carrito local — el backend solo recibe montos, nunca
porcentajes. El resumen de venta muestra **Subtotal bruto → Descuento →
ITBIS (sobre el neto) → Total**, replicando exactamente la fórmula de
`FacturacionService.crear()` (`totalLinea = cantidad*precio - descuento`)
para que el monto mostrado antes de cobrar coincida con el que el
backend termina calculando.

### Guardar / Guardadas — aparcar una venta (Fase 2d, F12 / ⇧F12)

Nuevo modelo tenant-scoped `VentaAparcada` + `VentaAparcadaLinea`
(`backend/src/pos/`, endpoints `POST /pos/turnos/:id/guardar`,
`GET /pos/turnos/:id/guardadas`, `DELETE /pos/ventas-aparcadas/:id`, todos
`pos.editar`). Deja "aparcar" el carrito actual (líneas, cliente,
vendedor, nota opcional) para atender otro cliente sin perderlo — el
caso real es un cajero interrumpido a media venta.

**Snapshot, no referencia viva**: `VentaAparcadaLinea` guarda
`precioUnitario`/`porcentajeItbis`/`descuento` en el momento de
guardar (mismas columnas que `LineaFactura`), no los deriva de
`Producto`/`Precio` al recuperar — si el precio del producto cambia
mientras la venta está aparcada, lo que se recupera sigue siendo el
monto original, no el nuevo. Encaja con el caso de uso (aparcar minutos
u horas, no días).

**Vive y muere con el turno**: `turnoCajaId` es `onDelete: Cascade` —
una venta aparcada no está pensada para sobrevivir al cierre del turno
(no hay flujo para recuperarla después de cerrado). El repositorio no
filtra por `cajeroId`: cualquiera con `pos.editar` que conozca el
`turnoCajaId` ve sus guardadas — aceptable porque hoy un turno ya es
1:1 con su cajero (`buscarTurnoAbierto` exige `bodegaId` único
`ABIERTO`), no hay caso real de "varios cajeros comparten turno".

**Recuperar = cargar + borrar, no "en uso"**: al elegir "Recuperar" en
`ModalGuardadas`, el frontend repone el carrito local y llama
`DELETE /pos/ventas-aparcadas/:id` de inmediato — no hay estado
intermedio de "prestada"; si el cajero se arrepiente después de
recuperarla, tendría que volver a guardarla (nueva fila). Elegido así
para no sumar un enum de estado a una entidad que ya es efímera por
diseño.

**Atajos F12/⇧F12**: nota conocida — Chrome reserva F12 para abrir
DevTools; en un teclado físico real el navegador puede interceptarlo
antes de que llegue a `useAtajosTeclado` (los eventos sintéticos vía
CDP sí llegan, que es como se verificó el flujo en esta fase). Se
mantiene por fidelidad al mapeo de teclas de Cuadre — ambos accesos
también tienen botón visible ("Guardar venta (F12)"/"Guardadas
(⇧F12)") para cuando el atajo no dispara.

### Devolución parcial desde POS (Fase 2e, F4)

Reusa el mecanismo de Nota de Crédito existente (`FacturacionService.
crear({ tipoFactura: 'NOTA_CREDITO', facturaOrigenId, lineas })`, que ya
soporta líneas/cantidades parciales) — **no** una tabla `DevolucionVenta`
propia, a diferencia del patrón que usa Compras (`DevolucionCompra`).
Se eligió así porque Facturación ya resuelve todo lo necesario (NCF
propio B04/E34, monto en negativo, reintegro de stock, exclusión al
recalcular lo ya devuelto en una eventual anulación posterior) sin
duplicar lógica.

- **`PosService.registrarDevolucion`** (`POST /pos/devoluciones`,
  permiso `facturacion.anular`): valida el turno abierto y la forma de
  pago (mismo patrón que `registrarVenta`), busca la factura origen vía
  `FacturacionService.buscarPorId` (ya incluye `lineas`,
  `notasRelacionadas` con sus líneas, y `cliente`), rechaza si no está
  `EMITIDA` o si es ella misma una nota. La bodega del reintegro es
  siempre **la del turno actual**, no la de la factura original — el
  reintegro físico ocurre donde está el cajero.
- **`calcularDisponibleParaDevolucion`** (privado, compartido entre
  `registrarDevolucion` y el endpoint de lectura de abajo): cantidad
  original menos lo ya devuelto por notas de crédito previas — mismo
  cálculo que `FacturacionService.anular()` ya usaba para no duplicar
  el reintegro de inventario al anular una factura con devoluciones
  parciales previas.
- **Descuento proporcional**: si la línea original tenía un `descuento`
  (monto flat), la nota de crédito prorratea `descuento original ×
  (cantidad devuelta / cantidad original)` — para que devolver la mitad
  de una línea con descuento no reintegre el monto lleno sin descontar.
- **`GET /pos/facturas/:id/devolucion`** (permiso `facturacion.anular`,
  no `facturacion.ver`): detalle de una factura con lo disponible por
  producto, para que `ModalDevolucion` (frontend) muestre cantidades
  antes de confirmar. Necesario porque Cajero/Vendedor **no tienen**
  `facturacion.ver` (se lo quitaron en una fase anterior, ver "Vendedor
  solo vende por POS" más abajo) — sin este endpoint dedicado, el
  Cajero no podría ver el detalle de la venta a devolver.
- **Alcance de búsqueda**: el modal de devolución solo ofrece elegir
  entre las facturas **del turno actual** (`data.facturas`, ya cargadas
  por `TurnoCajaDetalle`) — no hay buscador contra `/facturas?busqueda=`
  (exigiría `facturacion.ver`). Devolver una venta de un turno anterior
  queda fuera de alcance de esta fase.

### Pagos divididos y cierre por denominación (Fase 2f — la más grande de la adopción de Cuadre)

**Cierre por denominación** (100% frontend): `ModalCerrarTurno` reemplaza
el input único "Efectivo contado" por una fila por denominación (RD$
2000/1000/500/200/100/50/25/10/5/1) con un contador cada una; la suma
calculada se manda igual que siempre como `montoFinalContado` a
`POST /pos/turnos/:id/cerrar` — el backend no se entera del cambio.

**Pagos divididos**: nuevo modelo tenant-scoped-por-relación `PagoVenta`
(sin `tenantId` propio — hija de `Factura`, mismo patrón que
`LineaFactura`) — el ledger real de "con qué se pagó" una venta,
permitiendo varias formas de pago en la misma factura (ej. parte
efectivo + parte tarjeta). `RegistrarVentaPosDto.formaPagoId`/
`referenciaPago` (un solo método) pasaron a ser `pagos:
{formaPagoId, monto, referencia?}[]` (uno o más).

- **`FacturacionService.crear()`** valida `Σ pagos.monto === total`
  (EPSILON 0.005, mismo criterio que `PagosService`) **antes** de abrir
  la transacción — si no cuadra, `BadRequestException`, no se toca la
  base. Si el caller no manda `pagos` (Devolución, Fase 2e — un solo
  reintegro) pero sí `formaPagoId`/`referenciaPago` sueltos, se
  sintetiza un único pago con `monto: total` — **todo termina en el
  mismo ledger `PagoVenta`**, un solo camino de código en vez de dos.
  `Factura.formaPagoId`/`referenciaPago` (de Fase 1) se conservan como
  "forma de pago principal" (la de mayor `|monto|`) para lectura
  rápida/reportes — la fuente de verdad del arqueo es `PagoVenta`.
- **`PosRepository.calcularMovimientoEfectivo`** ya no suma
  `Factura.total` por `formaPago.esEfectivo` — suma `PagoVenta.monto`
  agrupado por `formaPago.esEfectivo`, vía `factura: { turnoCajaId,
  estado: 'EMITIDA' }`. Una venta con pago mixto solo cuenta su
  porción efectivo real; una devolución (Nota de Crédito, con su propio
  `PagoVenta` de monto negativo) resta sola, sin lógica especial.
- **El cambio (vuelto) nunca se persiste**: `ModalCheckout` (F10,
  frontend) deja agregar pagos con montos rápidos (Exacto/100/200/500/
  1000) hasta cubrir el total — si el cajero registra de más (ej. "pagó
  con 1000" en una venta de 700), el sobrante se muestra como cambio
  pero se recorta ANTES de enviar: el último pago se cap­ea a
  `total - Σ(pagos previos)` para que la suma enviada sea exacta,
  nunca el efectivo bruto entregado por el cliente.
- **Migración con backfill**: `20260819070000_pago_venta` crea
  `PagoVenta` y sembró un registro por cada `Factura` de POS ya
  existente (`formaPagoId`+`turnoCajaId` no nulos) con `monto: total` —
  para que el arqueo de turnos que ya estaban abiertos al migrar no
  perdiera el efectivo de ventas anteriores a este cambio.
- **`GET /pos/turnos/:id`** ahora incluye `facturas[].pagosVenta` (monto
  + `formaPago.esEfectivo`) para que el preview del frontend
  (`calcularMontoEsperado`) calcule exactamente lo mismo que el backend
  en vez de asumir 1 factura = 1 forma de pago.

### Roles de POS: Cajero, Vendedor, Supervisor de Caja

Investigando el patrón de sesión de caja más a fondo (Odoo multi-cajero,
X/Z reports de Lightspeed/ConnectPOS) surgieron dos huecos reales en el
modelo de un solo rol "Vendedor" que hacía de todo:

1. **Cajero de mostrador y vendedor de campo/oficina son roles
   distintos en la vida real** — antes estaban fusionados. Ahora:
   - **Vendedor**: `cotizaciones.*`, `remisiones.*`, `clientes.*`,
     `precios.ver` — sin ningún permiso `pos.*` ni `facturacion.*`. No
     toca caja en absoluto.
   - **Cajero**: `pos.ver`, `pos.editar`, `facturacion.anular`,
     `facturacion.imprimir`, `clientes.crear/ver`, `precios.ver` — solo
     POS, sin cotizaciones/remisiones.
2. **No existía forma de dar `pos.supervisar` (cerrar el turno de otro
   cajero, ver todos los turnos) sin también dar nómina/contabilidad/
   admin** — antes solo lo tenían Admin Total/Gerente. Nuevo rol
   **Supervisor de Caja**: igual que Cajero + `pos.supervisar`, nada más.

**`facturacion.anular` ahora tiene alcance acotado por rol.**
`FacturacionService.anular()` recibe un cuarto parámetro
(`puedeSupervisarCaja`, resuelto en el controller desde
`user.permisos.includes('pos.supervisar')`): si la factura vino de POS
(`turnoCaja` no nulo) y quien pide la anulación NO tiene
`pos.supervisar`, debe ser el mismo `cajeroId` del turno Y ese turno debe
seguir `ABIERTO` — si no, `ForbiddenException`. Un Supervisor de
Caja/Admin/Gerente nunca tiene esta restricción. El frontend
(`TurnoCajaDetalle.tsx`) oculta el botón "Anular/Devolver" cuando sabe
de antemano que fallaría (turno ya cerrado y sin `pos.supervisar`), pero
la regla real vive 100% en el backend.

Migrar tenants ya provisionados necesitó `backend/scripts/
migrar-roles-pos.ts` (uso: `pnpm --filter ./backend migrar-roles-pos`):
crea "Cajero"/"Supervisor de Caja" donde falten, suma el rol Cajero a
cada usuario que hoy tiene Vendedor (para no cortarles el acceso a POS
que ya tenían), y le quita a Vendedor los permisos que ya no le
corresponden — mismo patrón que `ajustar-permisos-vendedor-pos.ts`, ya
que `permisos:backfill` es aditivo y no crea roles nuevos ni quita
permisos.

**Apertura/cierre de turno en modal**: el cierre muestra el
`montoEsperado` calculado en el propio frontend (misma fórmula que
`PosService.cerrarTurno`) ANTES de que el cajero escriba el efectivo
contado, y la diferencia en vivo contra la tolerancia de referencia
(RD$50, el default de `POS_TOLERANCIA_ARQUEO`) — es solo una vista
previa; el backend sigue siendo quien valida y exige
`justificacionDiferencia` si corresponde, porque el tenant pudo haber
cambiado esa configuración.

### Modelo C: catálogo con foto + carrito persistente

`TurnoCajaDetalle.tsx` reemplazó el combobox+botón "Agregar" (un
producto a la vez, con un `GET /precios/:id` aparte por cada uno) por
un panel dividido: `CatalogoProductosPos` a la izquierda (grilla de
productos con foto, clic en una tarjeta agrega 1 unidad directo al
carrito) y el carrito persistente a la derecha (cliente, líneas,
totales, método de pago, "Cobrar"). El catálogo llama a
`GET /productos/catalogo`, no a `GET /productos` — ya trae `imagen` y
`precioVenta` (lista `GENERAL` vigente) en la misma fila, así que agregar
un producto ya no dispara una llamada aparte por precio.

**`Producto.imagen`** es una data URI completa, comprimida en el
navegador antes de subir (`lib/comprimir-imagen.ts`, redimensiona a 640px
y comprime a JPEG calidad 0.72 vía `<canvas>`) — mismo criterio que se
pensó para el logo del tenant. Por el tamaño que puede tomar un catálogo
entero de imágenes, `ProductosRepository.listar()` (el que alimenta
`Productos.tsx` y cualquier `ComboboxBusqueda`) tiene un **`select`
explícito que excluye `imagen` a propósito** — no debe cargarse un blob
por fila en cada tecla de búsqueda. Solo `catalogo()` (pensado para esta
grilla del POS) y `buscarPorId()` (detalle de un producto) la incluyen.
`PATCH /productos/:id` con `imagen: null` explícito la quita — un
`imagen` simplemente ausente en el body deja la existente intacta
(comportamiento normal de un `PATCH` parcial).

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
