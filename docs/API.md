# API

Swagger interactivo en `http://localhost:3000/api/docs` (incluye todos los
DTOs y permite probar con Bearer token). Este documento es un mapa rápido;
la fuente de verdad son los controllers en `backend/src/*/*.controller.ts`.

Todas las rutas (salvo `/auth/login`) requieren `Authorization: Bearer <token>`
y el permiso indicado.

Los endpoints marcados con `?pagina&tamanoPagina&busqueda` devuelven
`{ datos, total, pagina, tamanoPagina }` (nunca un array plano) — `total`
es la cantidad real que matchea el filtro, no el tamaño de `datos`. Los
tres query params son opcionales (`pagina=1`, `tamanoPagina=20` por
defecto); `busqueda` es texto libre, filtrado por cada endpoint sobre sus
propios campos relevantes (ver docs/ARCHITECTURE.md).

## Auth

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | público | `{ email, password, tenantSubdominio }` → `{ accessToken, usuario }` |
| POST | `/api/auth/password/olvide` | público (5/hora) | `{ email, tenantSubdominio }` → mensaje genérico siempre (no filtra si el email existe); envía el link por correo |
| POST | `/api/auth/password/restablecer` | público | `{ token, tenantSubdominio, password }` — token de un solo uso, vence en 1h |
| PUT | `/api/auth/mi-pin` | autenticado | `{ passwordActual, pin }` — Fase 9, autoservicio; `pin` de 4-6 dígitos |
| DELETE | `/api/auth/mi-pin` | autenticado | `{ passwordActual }` — Fase 9, elimina el PIN configurado |

## Plataforma (super admin — token y secreto separados del de tenants)

No hay alta del primer super admin por HTTP — se crea con
`pnpm --filter ./backend platform:bootstrap-admin` (ver
`docs/ARCHITECTURE.md`, sección "Auth de plataforma vs. tenant"). Admins
adicionales sí se crean por HTTP (`POST /platform/admins`), una vez que
existe al menos uno con `platform.admins.gestionar`. Todas las rutas
"Bearer de plataforma" además exigen el permiso de plataforma indicado
(RBAC de plataforma, ver ARCHITECTURE.md) — sin rol asignado, un admin no
pasa ninguna de ellas.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/platform/auth/login` | público | `{ email, password }` → `{ accessToken, admin }` (`admin.permisos` incluido) |
| POST | `/api/platform/auth/password/olvide` | público (5/hora) | `{ email }` → mensaje genérico siempre |
| POST | `/api/platform/auth/password/restablecer` | público | `{ token, password }` — token de un solo uso, vence en 1h |
| POST | `/api/platform/tenants` | `platform.tenants.crear` | `{ planId, nombre, subdominio, rnc?, adminEmail, adminNombre, adminPassword }` — crea el tenant + roles/permisos/configuración/usuario admin inicial, todo en una transacción |
| GET | `/api/platform/tenants` | `platform.tenants.ver` | Lista todos los tenants (con su `plan`) |
| GET | `/api/platform/tenants/:id` | `platform.tenants.ver` | |
| PATCH | `/api/platform/tenants/:id` | `platform.tenants.gestionar` | `{ nombre?, estado?, planId? }` — `estado: SUSPENDIDO` bloquea el login de ese tenant |
| GET | `/api/platform/audit-log?pagina&tamanoPagina&busqueda` | `platform.auditoria.ver` | Bitácora de acciones de plataforma (crear/suspender tenants, etc.) |
| GET | `/api/platform/planes` | `platform.planes.ver` | Catálogo de Planes, cada uno con sus módulos incluidos y su `precio`/`cicloFacturacion` |
| GET | `/api/platform/planes/modulos` | `platform.planes.ver` | Catálogo completo de `Modulo` (claves gateable, ver ARCHITECTURE.md) |
| POST | `/api/platform/planes` | `platform.planes.gestionar` | `{ nombre, descripcion?, precio?, cicloFacturacion?, modulos: string[] }` (claves) |
| PATCH | `/api/platform/planes/:id` | `platform.planes.gestionar` | `{ nombre?, descripcion?, precio?, cicloFacturacion?, modulos?: string[] }` |
| GET | `/api/platform/tenants/:tenantId/modulos` | `platform.tenants.ver` | Set efectivo de módulos (plan + excepciones) con su origen (`plan`\|`override`) |
| PATCH | `/api/platform/tenants/:tenantId/modulos/:clave` | `platform.tenants.gestionar` | `{ activo: boolean \| null }` — crea/actualiza la excepción; `null` la quita y vuelve a heredar del plan |
| GET | `/api/platform/roles/permisos` | `platform.roles.ver` | Catálogo completo de `PlatformPermission` |
| GET | `/api/platform/roles` | `platform.roles.ver` | Lista de `PlatformRole` con sus permisos |
| POST | `/api/platform/roles` | `platform.roles.gestionar` | `{ nombre, permisos: string[] }` (claves) |
| PATCH | `/api/platform/roles/:id` | `platform.roles.gestionar` | `{ nombre?, permisos?: string[] }` |
| GET | `/api/platform/admins` | `platform.admins.ver` | Lista de `PlatformAdmin` (sin `passwordHash`), con su rol |
| POST | `/api/platform/admins` | `platform.admins.gestionar` | `{ email, password, nombre, roleId? }` |
| PATCH | `/api/platform/admins/:id` | `platform.admins.gestionar` | `{ nombre?, activo?, roleId? }` — 400 si el admin autenticado intenta desactivarse a sí mismo |
| GET | `/api/platform/tenants/:tenantId/suscripcion` | `platform.facturacion.ver` | Plan/precio/próximo corte/fee de mora/estado de la suscripción del tenant |
| PATCH | `/api/platform/tenants/:tenantId/suscripcion` | `platform.facturacion.gestionar` | `{ feeMoraPct?, estado?: 'ACTIVA'\|'CANCELADA' }` |
| POST | `/api/platform/tenants/:tenantId/suscripcion/generar-factura` | `platform.facturacion.gestionar` | Genera una factura fuera de ciclo (misma lógica que el cron diario) |
| GET | `/api/platform/facturas?pagina&tamanoPagina&tenantId&estado` | `platform.facturacion.ver` | Listado paginado de `FacturaPlataforma` de todos los tenants |
| POST | `/api/platform/facturas` | `platform.facturacion.gestionar` | `{ tenantId, lineas: [{concepto, monto}], fechaVencimiento? }` — cargo puntual fuera del ciclo de suscripción, con líneas múltiples; 400 si el tenant no tiene `Suscripcion` |
| GET | `/api/platform/facturas/:id` | `platform.facturacion.ver` | |
| PATCH | `/api/platform/facturas/:id` | `platform.facturacion.gestionar` | `{ concepto?, descuento?, montoMora?, fechaVencimiento? }` — 400 si la factura ya está `PAGADA`/`ANULADA` |
| POST | `/api/platform/facturas/:id/anular` | `platform.facturacion.gestionar` | 400 si ya está `PAGADA` o tiene pagos registrados |
| GET | `/api/platform/facturas/:id/pagos` | `platform.facturacion.ver` | `{ pagos, totalPagado }` |
| POST | `/api/platform/facturas/:id/pagos` | `platform.pagos.registrar` | `{ monto, metodoPago, referencia?, fecha? }` — pagos parciales soportados, marca `PAGADA` al cubrir el total |
| GET | `/api/platform/configuracion` | `platform.configuracion.ver` | Config. general/notificaciones/pasarela/webhook — secretos nunca en claro, solo `{campo}Configurado: boolean` (ver ARCHITECTURE.md) |
| PATCH | `/api/platform/configuracion` | `platform.configuracion.gestionar` | Campos por sección (`nombreNegocio`, `smtpHost`/`smtpPassword`/…, `twilioAccountSid`/`twilioAuthToken`/…, `pasarelaActiva`/`stripeSecretKey`/…, `webhookUrl`/`webhookSecret`/`webhookActivo`) — en los de secreto: string = nuevo valor, `""` = borra el override, omitido = sin cambios. Aplica en caliente (sin reiniciar) |

## Pagos públicos (pago en línea de una factura — sin autenticación, ver ARCHITECTURE.md)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/pagos-publicos/facturas/:facturaId` | público | Datos seguros para la pantalla de pago (tenant, concepto, total, pendiente, estado); 404 si no existe |
| POST | `/api/pagos-publicos/facturas/:facturaId/checkout` | público | `{ url }` para redirigir a la pasarela activa; 400 si ya está `PAGADA`/`ANULADA` o sin saldo; 503 si la pasarela no está configurada (`STRIPE_SECRET_KEY`) |
| POST | `/api/pagos-publicos/webhook/stripe` | público (firma verificada) | Header `Stripe-Signature` requerido; 400 si la firma no verifica; en `checkout.session.completed` registra el pago automáticamente (idempotente) |

## NCF (por tenant)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/admin/ncf` | `admin.configuracion` — incluye `sucursal` (`{id, nombre}` o `null` = secuencia compartida) |
| POST | `/api/admin/ncf` | `admin.configuracion` — `{ tipoNcf, sucursalId?, secuenciaInicial?, secuenciaFinal, vigenciaHasta, umbralAlerta? }` (ítem B-2). Sin `sucursalId` = secuencia compartida por todas las sucursales, 409 si ya existe una compartida activa de ese tipo; con `sucursalId`, 404 si no pertenece al tenant |
| PATCH | `/api/admin/ncf/:id` | `admin.configuracion` — `{ secuenciaFinal?, vigenciaHasta?, activo?, umbralAlerta? }`. Identificado por `id` (no por `tipoNcf`) desde que puede haber varias filas por tipo, una por sucursal |

## Formas de pago (por tenant — catálogo configurable, reemplaza el enum fijo)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/formas-pago?activa=true` | sin permiso — cualquier usuario autenticado (POS/Cobranza/Compras necesitan leer el catálogo) |
| POST | `/api/formas-pago` | `admin.configuracion` — `{ nombre, requiereReferencia?, esEfectivo?, esBono?, tipo?, activa? }`; `tipo` (plan de integración Cuadre, ítem E-11) es un enum nullable de 8 categorías (`EFECTIVO`/`TARJETA`/`TRANSFERENCIA`/`CREDITO`/`BONO_VOUCHER`/`NOTA_CREDITO`/`CHEQUE`/`PUNTOS_LEALTAD`) puramente informativo — no reemplaza `esEfectivo`/`esBono`, que siguen gatillando el comportamiento real (arqueo de caja, canje de Bono). `esPuntosLealtad` (ítem A-3) NO es creable por este endpoint a propósito — la fila "Puntos de Lealtad" ya viene sembrada una sola vez por tenant (`FORMAS_PAGO_BASE`), evitando que un admin cree varias formas de pago con el mismo comportamiento especial |
| PATCH | `/api/formas-pago/:id` | `admin.configuracion` — parcial; `esEfectivo: true` desmarca automáticamente cualquier otra forma de pago del tenant |

## Facturación

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/facturas` | `facturacion.crear` — `{ clienteId, bodegaId, tipoFactura, lineas[], facturaOrigenId?, listaPrecio?, tipoComprobanteEspecial?, descuentoGeneralPct?, descuentoGeneralMonto?, plazoPagoDias? }`; `plazoPagoDias` (ítem B-6, uno de `15`/`30`/`45`/`60`/`90`) sin enviar cae al `@default(30)` del schema — el campo YA existía y `RecordatoriosService` YA lo consumía para facturas vencidas, lo que faltaba era poder elegirlo al crear; `facturaOrigenId` requerido para `NOTA_CREDITO`/`NOTA_DEBITO`; `listaPrecio` (nombre de `ListaPrecio`, no id) sobreescribe el nivel de precio resuelto del cliente para esta venta puntual — ver ARCHITECTURE.md, "Precios multinivel"; `tipoComprobanteEspecial` (`REGIMEN_ESPECIAL`\|`GUBERNAMENTAL`, plan de integración Cuadre ítem B-1) usa B14/B15 (o su e-CF) en vez del NCF normal — solo válido con `tipoFactura` CONTADO/CREDITO, se ignora en notas de crédito/débito; cada línea acepta `aplicaItbis?` (ítem B-7, default `true` — `false` fuerza 0% en esa línea) y `descuento?` (manual, gana sobre Ofertas automáticas); `descuentoGeneralPct`/`descuentoGeneralMonto` (ítem B-8, excluyentes entre sí, 400 si vienen ambos) prorratean un descuento de documento completo entre todas las líneas (recalculando ITBIS), acumulable con Ofertas automáticas y descuentos por línea — solo aplica a CONTADO/CREDITO, se ignora en notas de crédito/débito; 403 (Fase 9) si la bodega es de una sucursal no asignada al usuario (cubre también POS y conversión de Cotizaciones/Remisiones, que reusan este mismo endpoint internamente); 400 (ítem E-8) si alguna línea de una `NOTA_CREDITO` es de un producto con `permiteDevolucion: false` |
| GET | `/api/facturas?pagina&tamanoPagina&busqueda&tipoFactura` | `facturacion.ver` — `busqueda` filtra por NCF o nombre de cliente; `tipoFactura` (repetible: `?tipoFactura=NOTA_CREDITO&tipoFactura=NOTA_DEBITO`) filtra por tipo — usado por la pantalla de Notas de Crédito/Débito (Fase 4a de adopción de Cuadre) |
| GET | `/api/facturas/:id` | `facturacion.ver` |
| POST | `/api/facturas/:id/solicitar-autorizacion` | `facturacion.anular` (ítem D-1) — envía un código de un solo uso por email al encargado de la sucursal (o Admin Total si no hay uno asignado); responde `{ expiraEn, enviadoA: string[] }` (emails ofuscados, `he***@ejemplo.com`); vence en 5 minutos |
| POST | `/api/facturas/:id/anular` | `facturacion.anular` — `{ motivo, pin?, codigoAutorizacion? }` (Fase 9, `pin` requerido solo si el usuario tiene uno configurado; `codigoAutorizacion` — ítem D-1 — requerido solo si el tenant activó `AUTORIZACION_2FA_ANULAR`, se SUMA al PIN, no lo reemplaza); reversa el efecto de inventario (ver ARCHITECTURE.md); 400 si ya estaba anulada; 403 si la bodega de la factura es de una sucursal no asignada al usuario; si la factura es de POS y quien pide la anulación no tiene `pos.supervisar`, 403 salvo que sea el mismo cajero del turno Y siga `ABIERTO` (ver "Roles de POS" en ARCHITECTURE.md) |
| POST | `/api/facturas/:id/pagos` | `facturacion.cobrar` — `{ monto, formaPagoId, referencia?, fecha? }`; pagos parciales soportados, marca `pagada: true` al cubrir el total; 400 si el monto excede el saldo pendiente |
| GET | `/api/facturas/:id/pagos` | `facturacion.ver` — `{ pagos, totalPagado }` |
| GET | `/api/facturas/:id/imprimir?formato=CARTA\|A4\|TERMICA_80MM\|TERMICA_58MM` | `facturacion.imprimir` — sin `formato`, resuelve el default (override de bodega > default de tenant > CARTA, ver ARCHITECTURE.md); devuelve PDF o HTML según formato. Separado de `facturacion.ver` para que Vendedor pueda imprimir un recibo de POS sin ver la pantalla general de Facturación. Ítem H-3: incluye el logo/nota de pie configurados en Admin → Configuración general → Documentos, si el tenant los configuró (mismos en las 3 impresiones — Facturación/Cotizaciones/Remisiones) |
| POST | `/api/facturas/:id/enviar-recibo` | `facturacion.imprimir` (ítem F-4) — `{ canal: EMAIL\|WHATSAPP, destinatario }`. `destinatario` NO depende de `Cliente.email`/`telefono` guardado — se escribe en el momento (caso real: POS con Consumidor Final). Responde `{ enviado: boolean }` — `false` si el tenant no tiene una plantilla `factura_recibo` activa para ese canal (Admin → Notificaciones) |

## Ofertas (Fase 4b de adopción de Cuadre, ampliado en ítem A-2)

Descuentos automáticos, resueltos al facturar/cotizar (ver
ARCHITECTURE.md) — este CRUD solo administra el catálogo, la resolución
en sí no es un endpoint propio.

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/ofertas` | `ofertas.editar` — `{ nombre, tipoDescuento: PORCENTAJE\|MONTO_FIJO\|BOGO, valor?, comprarCantidad?, llevarCantidad?, porcentajeDescuentoLlevar?, descuentoMaximoMonto?, acumulable?, prioridad?, pagaComision?, alcance: PRODUCTO\|CATEGORIA\|CARRITO, productoId?, categoriaId?, montoMinimoCarrito?, fechaInicio, fechaFin }`; `productoId`/`categoriaId`/`montoMinimoCarrito` son mutuamente exclusivos según `alcance` (400 si no corresponden); `fechaInicio`/`fechaFin` admiten hora exacta, no solo el día (ítem A-2, "vigencia por hora"). Ítem A-2 — `tipoDescuento: BOGO` ("Compra X Lleva Y" / "Segunda Unidad"): `valor` se ignora, en su lugar exige `comprarCantidad`/`llevarCantidad` (400 si faltan) y NO admite `alcance: CARRITO` (400 — no hay "unidad" que contar sobre un total); `porcentajeDescuentoLlevar` (0-100, default 100 = gratis; 50 = "segunda unidad a mitad de precio") es opcional incluso en BOGO. Para PORCENTAJE/MONTO_FIJO, `valor` sigue siendo obligatorio (400 si falta). `descuentoMaximoMonto` (RD$, cualquier tipo) topea el descuento resultante — sin esto, sin límite más allá del propio monto de la línea/carrito. `acumulable` (default `false`) y `prioridad` (default `0`, menor = mayor prioridad) controlan cómo se combina esta oferta con otras que matcheen la misma línea/carrito al mismo tiempo — ver ARCHITECTURE.md. `pagaComision` (default `true`) — si es `false`, una línea descontada por ESTA oferta no genera comisión de venta (ítem A-1, "todo o nada" — ver ARCHITECTURE.md) |
| GET | `/api/ofertas` | `ofertas.ver` |
| PATCH | `/api/ofertas/:id` | `ofertas.editar` — mismas reglas de exclusividad que crear |
| DELETE | `/api/ofertas/:id` | `ofertas.editar` |

## Comisiones de venta (ítem A-1)

Solo reportes de solo lectura — la comisión se calcula y persiste sola
(`ComisionVenta`) al facturar, vía Event Bus (`ComisionesEventosService`
reacciona a `factura.creada`/`factura.anulada`), no hay endpoint de
escritura. `desde`/`hasta` (`ISO date`, opcionales) — default últimos 30
días hasta hoy, mismo criterio que `/reportes/ventas`.

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/comisiones/por-venta` | `comisiones.ver` — una fila por factura con comisión generada: `{ facturaId, ncf, fecha, cliente, empleado, montoTotal, cantidadLineas }` |
| GET | `/api/comisiones/por-vendedor` | `comisiones.ver` — agregado por Empleado: `{ empleadoId, empleado, montoTotal, cantidadVentas }` |
| GET | `/api/comisiones/por-producto` | `comisiones.ver` — agregado por Producto: `{ productoId, producto, montoTotal, cantidadLineas }` |

Una venta solo genera comisión si tiene `vendedorEmpleadoId` (ventas de
POS que eligen un vendedor, ítem F-2 — `PosService.registrarVenta`) y es
`CONTADO`/`CREDITO` (una Nota de Crédito/Débito no genera su propia
comisión). Por línea: comisión = `Producto.porcentajeComision` (% sobre
el monto neto sin ITBIS, después de descuento) o
`Producto.montoComisionFijo` (RD$ fijos × cantidad) — mutuamente
excluyentes, configurados en `POST`/`PATCH /api/productos` (400 si
vienen ambos). Una línea con `pagaComision:false` (heredado de una
Oferta que no paga comisión, ver arriba) no genera fila. Al anular la
factura de origen, sus comisiones se marcan `anulada:true` (nunca se
borran).

## Lealtad / puntos (ítem A-3)

Programa de puntos por venta, apagado por defecto. Los puntos se ganan
solos al facturar (Event Bus) y se canjean como forma de pago "Puntos
de Lealtad" en Facturación/POS — no hay endpoint propio de canje, se
resuelve dentro de `POST /api/facturas`/`POST /api/pos/ventas` cuando
una línea de `pagos` usa esa `formaPagoId`.

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/lealtad/configuracion` | `lealtad.ver` |
| PATCH | `/api/lealtad/configuracion` | `lealtad.editar` — `{ activo?, modoAcumulacion?: POR_MONTO\|POR_UNIDAD, montoPorPunto?, calcularSobre?: SUBTOTAL\|TOTAL, itemsConDescuentoGeneranPuntos?, valorPunto?, minimoParaCanjear?, diasExpiracion? }`; `montoPorPunto` obligatorio (400 si falta) cuando `modoAcumulacion=POR_MONTO` |
| GET | `/api/lealtad/clientes/:clienteId/historial` | `lealtad.ver` — ledger completo (`ACUMULACION`/`CANJE`/`EXPIRACION`/`AJUSTE`) de ese cliente |
| POST | `/api/lealtad/ajuste` | `lealtad.editar` — `{ clienteId, puntos, motivo }`, ajuste manual con signo (positivo acredita, negativo descuenta) |

Puntos ganados: solo en ventas `CONTADO`/`CREDITO` con el programa
activo — `POR_MONTO` calcula `floor(base/montoPorPunto)` (`base` = suma
de las líneas calificantes, neto sin ITBIS o con ITBIS según
`calcularSobre`); `POR_UNIDAD` suma la cantidad de esas líneas.
`itemsConDescuentoGeneranPuntos:false` excluye cualquier línea con
descuento (manual, Oferta o general). Canje: convierte el monto RD$ de
la línea de pago a puntos (`Math.ceil(monto/valorPunto)`), rechaza si
el programa no está activo, `valorPunto` es 0, el resultado no alcanza
`minimoParaCanjear`, o el cliente no tiene saldo suficiente — consume
primero los puntos más próximos a vencer (FEFO). Al anular la factura
de origen, la acumulación/canje de esa venta se revierte — ver
ARCHITECTURE.md para el alcance exacto.

## Bonos (Fase 4c de adopción de Cuadre)

Gift cards emitidas en lote, canjeables como forma de pago en
Facturación/POS seleccionando la forma "Bono" y tipeando el código en
`referencia` (ver ARCHITECTURE.md) — este CRUD solo administra
emisión/consulta/anulación, el canje en sí ocurre dentro de
`POST /api/facturas`/`POST /api/pos/ventas`, no es un endpoint propio.

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/bonos/lotes` | `bonos.editar` — `{ cantidad (1-500), montoPorBono, fechaVencimiento }`, devuelve el arreglo de bonos creados (con su `codigo`) |
| GET | `/api/bonos?busqueda` | `bonos.ver` — `busqueda` filtra por código |
| POST | `/api/bonos/:id/anular` | `bonos.editar` — 400 si ya estaba `ANULADO` |

## Cotizaciones

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/cotizaciones` | `cotizaciones.crear` — `{ clienteId, fechaVigenciaHasta, lineas[], listaPrecio? }` — mismo override de nivel de precio que Facturación |
| GET | `/api/cotizaciones?pagina&tamanoPagina&busqueda` | `cotizaciones.ver` — `busqueda` filtra por nombre de cliente |
| GET | `/api/cotizaciones/:id` | `cotizaciones.ver` |
| PATCH | `/api/cotizaciones/:id/estado` | `cotizaciones.editar` — `{ estado: ENVIADA\|ACEPTADA\|RECHAZADA }` |
| POST | `/api/cotizaciones/:id/convertir` | `cotizaciones.editar` — `{ bodegaId, tipoFactura: CONTADO\|CREDITO }`, crea la factura y marca la cotización convertida |
| GET | `/api/cotizaciones/:id/imprimir?formato=...` | `cotizaciones.ver` — igual que en Facturación; sin bodega propia, solo aplica el default de tenant |

## Remisiones

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/remisiones` | `remisiones.crear` — `{ clienteId, bodegaId, numero, lineas[] }` (sin efecto en inventario) |
| GET | `/api/remisiones?pagina&tamanoPagina&busqueda` | `remisiones.ver` — `busqueda` filtra por número o cliente |
| GET | `/api/remisiones/:id` | `remisiones.ver` |
| PATCH | `/api/remisiones/:id/estado` | `remisiones.editar` — `{ estado: ENTREGADA\|ANULADA }` |
| POST | `/api/remisiones/:id/convertir` | `remisiones.editar` — `{ tipoFactura: CONTADO\|CREDITO }`, recién aquí descuenta inventario |
| GET | `/api/remisiones/:id/imprimir?formato=...` | `remisiones.ver` — igual que en Facturación |

## Productos

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/productos` | `precios.editar` — acepta `imagen` (data URI, opcional), `leyFiscalId?` (FK a `LeyFiscal`, plan de integración Cuadre ítem B-3 — reduce el ITBIS efectivo del producto, `null` explícito quita la asignación) y, ítem E-8: `unidadMedida?` (lista cerrada — UND/KILOGRAMO/GRAMO/LIBRA/ONZA/LITRO/MILILITRO/GALON/PORCION/DOCENA), `precioVariable?` (habilita precio editable por línea en el carrito del POS), `esIngrediente?` (informativo), `permiteDevolucion?` (default `true` — si es `false`, el producto no puede incluirse en una Nota de Crédito); ítem A-1: `porcentajeComision?`/`montoComisionFijo?` (mutuamente excluyentes, 400 si vienen ambos, `null` explícito quita la asignación) — ver "Comisiones de venta" |
| POST | `/api/leyes-fiscales` | `precios.editar` — `{ codigo, nombre, porcentajeItbisAPagar, descripcion?, activa? }` (ítem B-3) |
| GET | `/api/leyes-fiscales?activa=true` | `precios.ver` |
| PATCH | `/api/leyes-fiscales/:id` | `precios.editar` |
| GET | `/api/productos?pagina&tamanoPagina&busqueda&categoriaId` | `precios.ver` — `busqueda` filtra por nombre o código, `categoriaId` filtra exacto (no incluye descendientes); NUNCA incluye `imagen` (ver ARCHITECTURE.md) |
| GET | `/api/productos/catalogo?pagina&tamanoPagina&busqueda&categoriaId` | `precios.ver` — para el catálogo de POS: incluye `imagen` y `precioVenta` (lista GENERAL vigente) en cada fila; `categoriaId` filtra exacto |
| GET | `/api/productos/:id` | `precios.ver` — sí incluye `imagen` |
| PATCH | `/api/productos/:id` | `precios.editar` — `imagen: null` explícito quita la foto existente; `categoriaId: null` explícito quita la categoría asignada; `atributos` (ver abajo) regenera las variantes del producto |
| GET | `/api/productos/exportar` | `precios.ver` — catálogo completo en `.xlsx` (código, nombre, categoría, tipo, unidad, ITBIS %, precio GENERAL, código de barras, stock total); mismo criterio de "variante representativa" que `catalogo()` para el precio, pero código de barras/stock se agregan sobre TODAS las variantes del producto (Fase 3e) |
| POST | `/api/productos/importar` | `precios.editar` — `{ productos: [{ codigo, nombre, categoria?, tipo?, unidadMedida?, porcentajeItbis?, precioGeneral?, codigoBarras? }] }`, upsert por código; cada fila se procesa independiente (un error no aborta las demás) — responde `{ creados, actualizados, errores: [{codigo, mensaje}] }`. NO soporta COMBO, variantes reales de Talla/Color (el precio/código de barras se aplican a la variante "por defecto" — 400 por fila si el producto ya tiene varias) ni stock (Fase 3e) |

`PATCH /api/productos/:id` con `atributos: [{ atributoId, valoresIds: string[] }]` genera el producto cartesiano de los valores elegidos — una `VarianteProducto` por combinación — y **reemplaza por completo** las variantes actuales del producto (Fase 3c, ver ARCHITECTURE.md). `atributos: []` revierte a una única variante "por defecto" sin atributos; omitir el campo no toca las variantes. 400 si algún valor no pertenece al atributo indicado, si la combinatoria supera 400 variantes, o si las variantes actuales ya tienen movimientos de inventario registrados (no se puede regenerar variantes de un producto que ya tuvo actividad de stock).

## Atributos y variantes

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/atributos` | `precios.editar` — `{ nombre }` (ej. "Talla", "Color") |
| GET | `/api/atributos` | `precios.ver` — con sus valores incluidos |
| POST | `/api/atributos/:id/valores` | `precios.editar` — `{ valor }` (ej. "M", "Azul") |
| DELETE | `/api/atributos/:id/valores/:valorId` | `precios.editar` — 400 si el valor está en uso por alguna variante |
| DELETE | `/api/atributos/:id` | `precios.editar` — 400 si alguno de sus valores está en uso |
| GET | `/api/productos/:productoId/variantes` | `precios.ver` — variantes del producto con sus valores de atributo |
| PATCH | `/api/productos/:productoId/variantes/:varianteId` | `precios.editar` — `{ codigoBarras: string \| null }` (Fase 3d); `null` explícito quita el código asignado; 400 si la variante no pertenece a `productoId` |

Toda línea de venta/compra (`/api/facturas`, `/api/cotizaciones`,
`/api/remisiones`, `/api/compras`, `/api/pos/ventas`) acepta
`varianteId?` opcional junto a `productoId`. Si el producto tiene una
sola variante (el caso normal, sin atributos reales), se resuelve solo
y `varianteId` puede omitirse. Si tiene más de una, es **obligatorio**
— 400 con un mensaje claro si falta, y 400 si la variante indicada no
pertenece a ese producto. Ver `VariantesService.resolverObligatoria` en
ARCHITECTURE.md.

`busqueda` en `GET /api/productos` y `GET /api/productos/catalogo`
(Fase 3d) también matchea `VarianteProducto.codigoBarras` — un lector
de código de barras USB (emula teclado + Enter) ya funciona tal cual
contra el buscador de catálogo y del POS, sin integración especial. La
impresión de etiquetas (hoja con nombre + variante + barcode) es
100% client-side (`frontend/src/lib/etiquetas-codigo-barras.ts`, vía
`jsbarcode`) — no hay endpoint de backend involucrado.

## Categorías

Catálogo tenant-scoped con jerarquía real (mismo patrón de auto-relación que `CuentaContable.cuentaPadreId`, ver ARCHITECTURE.md). Reemplaza el antiguo `GET /api/productos/categorias` (texto libre sin tabla propia).

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/categorias` | `precios.editar` — `{ nombre, categoriaPadreId?, color? }`; `color` (plan de integración Cuadre, ítem E-9) es puramente decorativo — un enum de 12 valores (`ColorCategoria`) sin ningún significado de negocio, solo para escaneo visual rápido en la grilla de categorías del POS |
| GET | `/api/categorias` | `precios.ver` — listado plano con `categoriaPadreId`; el cliente arma el árbol (ver `frontend/src/lib/categorias-arbol.ts`) |
| PATCH | `/api/categorias/:id` | `precios.editar` — rechaza auto-referencia y ciclos (`categoriaPadreId` no puede ser un descendiente propio) |
| DELETE | `/api/categorias/:id` | `precios.editar` — rechaza (400) si tiene productos o subcategorías asignadas |

## Inventario

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/inventario/bodegas` | sin permiso — cualquier usuario autenticado (un Cajero puro necesita esta lista para abrir su turno de POS y no tiene `inventario.ver`) |
| POST | `/api/inventario/bodegas` | `admin.configuracion` — `sucursalId` requerido desde Fase 8 (400/404 si no pertenece al tenant) |
| PATCH | `/api/inventario/bodegas/:id` | `admin.configuracion` — solo `{ formatoImpresion? }` (`null` quita el override, hereda el default del tenant) |
| POST | `/api/sucursales` | `sucursales.editar` — `{ nombre, nombreComercial?, telefono?, direccion?, ciudad? }` (RRHH/Sucursales, Fase 8a) |
| GET | `/api/sucursales` | `sucursales.ver` — sin paginar |
| GET | `/api/sucursales/:id` | `sucursales.ver` |
| PATCH | `/api/sucursales/:id` | `sucursales.editar` — cualquier campo de arriba + `activa` |
| PUT | `/api/admin/usuarios/:id/sucursales` | `admin.usuarios` — reemplaza el set completo (`{ sucursalIds: string[] }`, `[]` = ve todas — RRHH/Sucursales, Fase 8b) |
| GET | `/api/sucursales/mias` | Autoservicio, sin permiso — sucursales asignadas al usuario logueado, o todas si no tiene ninguna (Fase 8c) |
| GET | `/api/inventario/stock/:bodegaId` | `inventario.ver` — cada fila incluye `varianteId` y `valoresAtributo` (Fase 3c) además de `producto`: un producto con variantes reales tiene una fila de stock POR variante |
| GET | `/api/inventario/kardex/:varianteId?bodegaId&desde&hasta` | `inventario.ver` — historial cronológico con saldo corriente (Fase 5a); sin `desde`/`hasta`, default mes actual (mismo criterio que `libro-mayor`); sin paginar — devuelve `{ variante, bodegaId, rango, saldoInicial, movimientos, saldoFinal }`; `bodegaId` es opcional (plan de integración Cuadre, ítem E-3) — omitido, agrega el movimiento de TODAS las bodegas del tenant (cada fila de `movimientos` incluye su `bodega`), el saldo corriente sigue siendo válido porque cada movimiento ya trae su propio signo ENTRADA/SALIDA |
| GET | `/api/inventario/lotes?varianteId&bodegaId` | `inventario.ver` — lotes con saldo de esa variante+bodega (Fase 5b), para elegir "de qué lote sale" en devolución a proveedor / ajuste manual negativo |
| GET | `/api/inventario/vencimientos?diasProximidad` | `inventario.ver` — lotes con saldo que vencen dentro de `diasProximidad` (default 30, Fase 5b), todas las bodegas del tenant; sin paginar |
| POST | `/api/inventario/ajustar` | `inventario.ajustar` — `{ productoId, varianteId?, bodegaId, cantidad, motivoAjuste, motivo?, numeroLote?, fechaVencimiento?, loteId?, pin? }`; `motivoAjuste` (plan de integración Cuadre, ítem E-2) es un enum obligatorio — `MERMA`/`ROBO_PERDIDA`/`DANO`/`VENCIMIENTO`/`CORRECCION_CONTEO`/`OTRO` — y `motivo` (texto libre) pasó a opcional, solo detalle adicional; `numeroLote`+`fechaVencimiento` obligatorios si el producto controla vencimiento y `cantidad > 0` (entrada); `loteId` obligatorio si controla vencimiento y `cantidad < 0` (salida, siempre explícito — nunca FEFO en una corrección manual); `pin` (Fase 9) requerido solo si `cantidad < 0` y el usuario tiene uno configurado; 403 si la bodega es de una sucursal no asignada al usuario |
| POST | `/api/inventario/transferir` | `inventario.transferir` — `{ productoId, varianteId?, bodegaOrigenId, bodegaDestinoId, cantidad }`; si el producto controla vencimiento, FEFO automático en origen y el lote (número+vencimiento) se preserva intacto en destino; 403 (Fase 9) si el usuario no tiene acceso a la sucursal de la bodega de ORIGEN o de DESTINO (exige las dos, no solo una) |

## Precios

`varianteId` (Fase 3c, incremento 4) sigue el mismo criterio que las
líneas de venta/compra: se resuelve solo si el producto tiene una única
variante; obligatorio (400) si tiene varias — sin esto no hay forma de
saber a cuál de las variantes reales le corresponde el precio.

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/precios/:productoId?varianteId&listaPrecio` | `precios.ver` |
| GET | `/api/precios/:productoId/historial?varianteId&listaPrecio` | `precios.ver` |
| POST | `/api/precios` | `precios.editar` — `{ productoId, varianteId?, listaPrecio?, costo, margenPct?, precioVenta? }` |

## Compras

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/compras` | `compras.crear` |
| GET | `/api/compras?pagina&tamanoPagina&busqueda` | `compras.ver` — `busqueda` filtra por número de orden o nombre de proveedor |
| GET | `/api/compras/:id` | `compras.ver` |
| POST | `/api/compras/:id/recibir` | `compras.recibir` — cada línea admite `numeroLote?`/`fechaVencimiento?` (Fase 5b), obligatorios si el producto controla vencimiento; 403 (Fase 9) si la bodega destino es de una sucursal no asignada al usuario |
| POST | `/api/compras/:id/devolver` | `compras.recibir` — devolución parcial de mercancía ya recibida; cada línea admite `loteId?` (Fase 5b), obligatorio si el producto controla vencimiento (elegido a mano, nunca FEFO); 403 (Fase 9) si la bodega es de una sucursal no asignada al usuario |
| POST | `/api/compras/:id/pagos` | `compras.pagar` — `{ monto, formaPagoId, referencia?, retencionIsr?, retencionItbis?, fecha? }`; pagos parciales soportados, marca `pagada: true` al cubrir el total |
| GET | `/api/compras/:id/pagos` | `compras.ver` — `{ pagos, totalPagado }` |

## Clientes / Proveedores

| Método | Ruta | Permiso |
|---|---|---|
| POST / PATCH | `/api/clientes` | `clientes.*` — acepta `listaPrecioId` (FK a `ListaPrecio`, `null` explícito quita la asignación); `categoriaId` (FK a `CategoriaCliente`, ítem E-5, `null` quita la asignación) y `comprobantePorDefecto` (`CONTADO`\|`CREDITO`\|`REGIMEN_ESPECIAL`\|`GUBERNAMENTAL`, ítem E-5) — autoselecciona `tipoFactura`/`tipoComprobanteEspecial` al elegir el cliente en el formulario de Facturación, el usuario lo puede cambiar igual |
| GET | `/api/clientes?pagina&tamanoPagina&busqueda` | `clientes.ver` — `busqueda` filtra por nombre, email o RNC/cédula; cada fila trae `puntosLealtad` (ítem A-3, saldo denormalizado, ver "Lealtad / puntos") |
| POST | `/api/categorias-cliente` | `clientes.editar` — `{ nombre, activa? }` — catálogo de segmentación de cliente (ítem E-5), plano, puramente informativo |
| GET | `/api/categorias-cliente?activa=true` | `clientes.ver` |
| PATCH | `/api/categorias-cliente/:id` | `clientes.editar` |
| POST | `/api/proveedores` | `compras.*` |
| GET | `/api/proveedores?pagina&tamanoPagina&busqueda` | `compras.ver` — `busqueda` filtra por nombre o RNC |

## Listas de precio

Catálogo de niveles de precio por tenant (Fase 3b de adopción de Cuadre) —
alimenta `Cliente.listaPrecioId` y el override manual de
Facturación/Cotizaciones/POS. Sin endpoint de borrado — se desactiva, no
se elimina (igual criterio que Formas de pago).

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/listas-precio` | `precios.editar` — `{ nombre, activa? }` |
| GET | `/api/listas-precio?activa=true` | `precios.ver` — sin el query param trae también las inactivas |
| PATCH | `/api/listas-precio/:id` | `precios.editar` — 400 si se intenta renombrar la lista `"GENERAL"` (default histórico de `Precio.listaPrecio`) |

## Notificaciones

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/notificaciones?pagina&tamanoPagina&busqueda` | autenticado — `busqueda` filtra por destinatario o asunto |
| GET | `/api/notificaciones/plantillas` | `admin.configuracion` |
| POST | `/api/notificaciones/plantillas` | `admin.configuracion` — `{ canal: EMAIL\|WHATSAPP\|IN_APP\|WEBHOOK, clave, asunto?, cuerpo }`, upsert por `(tenant, canal, clave)` |

## Webhooks

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/webhooks` | `admin.configuracion` |
| GET | `/api/webhooks` | `admin.configuracion` |
| DELETE | `/api/webhooks/:id` | `admin.configuracion` |

Payload que reciben (`POST` a la `url` registrada), firmado con
`X-Sol-Signature: HMAC-SHA256(body, webhook.secret)`:

```json
{
  "evento": "factura.creada",
  "payload": { "tenantId": "...", "facturaId": "...", "clienteId": "...", "total": "1500.00" },
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

Reintenta hasta 3 veces (sin espera, luego 2s, luego 8s) antes de marcar
la entrega como fallida en `webhook_deliveries` — ver ARCHITECTURE.md.

## Plugins

Rutas bajo `/api/plugins/<clave>/...`, protegidas además por
`@RequiereModulo('<clave>')` (403 si el tenant no tiene ese módulo activo
— plan + excepciones, ver ARCHITECTURE.md). La activación ya no es
self-service del tenant: la decide la plataforma vía
`/api/platform/tenants/:tenantId/modulos/:clave` (ver arriba).
Ver `plugins/inmobiliaria/src/inmobiliaria.controller.ts`.

## Admin (usuarios, configuración)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/admin/roles` | `admin.usuarios` |
| POST | `/api/admin/usuarios` | `admin.usuarios` |
| GET | `/api/admin/usuarios?pagina&tamanoPagina&busqueda` | `admin.usuarios` — `busqueda` filtra por nombre o email |
| GET | `/api/admin/usuarios/:id` | `admin.usuarios` |
| PATCH | `/api/admin/usuarios/:id` | `admin.usuarios` — `{ nombre?, activo?, rolIds? }` (rolIds reemplaza los roles asignados) |
| GET | `/api/admin/configuraciones` | `admin.configuracion` |
| PUT | `/api/admin/configuraciones/:clave` | `admin.configuracion` — `{ valor }`, upsert (crea la clave si no existe) |

## Reportes

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/reportes/dashboard?sucursalId` | `reportes.ver` — `{ ventasHoyTotal, facturasHoyCantidad, productosStockBajo, ordenesCompraPendientes, alertasInventario: {sinStock, stockBajo, porVencer7Dias, vencidos} }` (ítem E-4), cacheado en Redis 30s por tenant+sucursal. `sucursalId` opcional (Fase 8d) filtra los primeros 3 KPIs y `alertasInventario`; `ordenesCompraPendientes` siempre tenant-wide (`OrdenCompra` no tiene `bodegaId` propio). `porVencer7Dias`/`vencidos` usan un umbral fijo de 7 días, independiente del umbral de 30 días del cron de avisos (`LotesCronService`) |
| GET | `/api/reportes/ventas?desde&hasta` | `reportes.ver` — facturas emitidas en el rango (default: últimos 30 días) + resumen |
| GET | `/api/reportes/ventas/exportar?desde&hasta&formato=xlsx\|pdf` | `reportes.ver` — descarga binaria (`.xlsx` real vía exceljs, `.pdf` real vía pdfkit) |
| GET | `/api/reportes/ventas/agrupado?desde&hasta&dimension=cliente\|categoria\|producto\|vendedor\|formaPago\|codigoAlterno` | `reportes.ver` — catálogo de reportes ampliado (ítem J-2), sin exportador xlsx/pdf todavía |
| GET | `/api/reportes/ventas/rentabilidad?desde&hasta` | `reportes.ver` — margen bruto por producto (ítem J-2); usa el costo VIGENTE hoy, no el histórico al momento de la venta |
| GET | `/api/reportes/inventario?sucursalId` | `reportes.ver` — snapshot de stock actual por producto/bodega + resumen, cacheado en Redis 30s por tenant+sucursal. `sucursalId` opcional (Fase 8d) |
| GET | `/api/reportes/inventario/exportar?sucursalId&formato=xlsx\|pdf` | `reportes.ver` |
| GET | `/api/reportes/compras?desde&hasta` | `reportes.ver` — órdenes de compra en el rango + resumen por estado |
| GET | `/api/reportes/compras/exportar?desde&hasta&formato=xlsx\|pdf` | `reportes.ver` |

Los endpoints `/exportar` devuelven el archivo directamente (`Content-Type`
+ `Content-Disposition: attachment`), no JSON — el frontend los descarga
con `responseType: 'blob'` (ver
`frontend/src/components/molecules/BotonesExportar/BotonesExportar.tsx`).

## Contabilidad

Los asientos generados automáticamente desde facturación/compras (ver
ARCHITECTURE.md) no pasan por estos endpoints de escritura — se crean
directamente vía `ContabilidadEventosService`. `POST .../asientos` es
para asientos manuales (ajustes, apertura, etc.).

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/contabilidad/cuentas` | `contabilidad.ver` — catálogo de cuentas activas |
| POST | `/api/contabilidad/cuentas` | `contabilidad.editar` — crear cuenta nueva (código, nombre, tipo, naturaleza) |
| GET | `/api/contabilidad/asientos?pagina&tamanoPagina&busqueda` | `contabilidad.ver` — paginado |
| GET | `/api/contabilidad/asientos/:id` | `contabilidad.ver` |
| POST | `/api/contabilidad/asientos` | `contabilidad.editar` — asiento manual; 400 si débito ≠ crédito |
| GET | `/api/contabilidad/balance-general?fecha` | `contabilidad.ver` — activo/pasivo/patrimonio a la fecha (default: hoy), incluye `diferencia` (debería ser ~0) |
| GET | `/api/contabilidad/estado-resultados?desde&hasta` | `contabilidad.ver` — ingresos/gastos/utilidadNeta en el rango (default: mes actual) |

## Nómina

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/nomina/empleados?pagina&tamanoPagina&busqueda&puestoId` | `nomina.ver` — busca por nombre/cédula/cargo; `puestoId` (ítem G-8) filtra por el catálogo de puestos |
| GET | `/api/nomina/empleados/:id` | `nomina.ver` |
| POST | `/api/nomina/empleados` | `nomina.editar` — acepta `puestoId` (ítem G-8, FK a `Puesto`) además de `cargo` (texto libre, sin cambios — sigue siendo lo que resuelve "Vendedor" en `GET /pos/vendedores`); acepta `plantillaHorarioId` (ítem G-1) — sin enviarlo, se auto-asigna la plantilla marcada `predeterminada` del tenant, si existe alguna |
| PATCH | `/api/nomina/empleados/:id` | `nomina.editar` — enviar `fechaSalida` desactiva al empleado automáticamente; `puestoId: null` desvincula el puesto; `plantillaHorarioId: null` desvincula la plantilla (el empleado vuelve a su `HorarioEmpleado` individual) |
| POST | `/api/nomina/puestos` | `nomina.editar` — `{ nombre, activo? }` — catálogo de puestos (ítem G-8), plano |
| GET | `/api/nomina/puestos?activo=true` | `nomina.ver` |
| PATCH | `/api/nomina/puestos/:id` | `nomina.editar` |
| GET | `/api/nomina/periodos?pagina&tamanoPagina` | `nomina.ver` |
| GET | `/api/nomina/periodos/:id` | `nomina.ver` — incluye los recibos con su empleado |
| POST | `/api/nomina/periodos` | `nomina.editar` — genera recibos para todos los empleados activos (`{ tipo: SEMANAL\|QUINCENAL\|BIMENSUAL\|MENSUAL, fechaInicio, fechaFin }`); `SEMANAL`/`BIMENSUAL` (plan de integración Cuadre, ítem G-7) usan el factor de `FACTOR_PERIODO_NOMINA` (`nomina-config.ts`) — `SEMANAL` = 7 días del divisor legal 23.83 (no un genérico mes/4), `BIMENSUAL` = mismo factor 0.5 que `QUINCENAL` (RAE: "dos veces al mes", no "cada dos meses"). Tasas/topes de TSS (ítem G-6) se leen de `Configuracion.NOMINA_TASA_*`/`NOMINA_TOPE_*` (edítables en Admin → Parámetros), cayendo a `TASAS_TSS`/`TOPES_TSS` si el tenant no las personalizó — el ISR sigue fijo en código, no configurable |
| POST | `/api/nomina/periodos/:id/procesar` | `nomina.editar` — `BORRADOR → PROCESADO`, 400 si ya no está en BORRADOR |
| POST | `/api/nomina/periodos/:id/marcar-pagado` | `nomina.editar` — `PROCESADO → PAGADO`, dispara el asiento contable automático (ver ARCHITECTURE.md) |
| GET | `/api/nomina/empleados/:empleadoId/horario` | `rrhh.ver` — horario INDIVIDUAL semanal (RRHH, Fase 7a); si el empleado tiene una plantilla asignada (`plantillaHorarioId`, ítem G-1), este endpoint sigue devolviendo su horario individual guardado (si tiene) pero deja de ser el efectivo — ver `resolverDiasEfectivos` |
| PUT | `/api/nomina/empleados/:empleadoId/horario` | `rrhh.editar` — reemplaza el horario INDIVIDUAL completo (`{ dias: [{ diaSemana, horaEntrada, horaSalida }] }`, `dias: []` lo deja sin ningún día configurado) — no tiene efecto en tardanza/horas extra mientras el empleado tenga una plantilla asignada |
| POST | `/api/nomina/plantillas-horario` | `rrhh.editar` — `{ codigo, nombre, descripcion?, predeterminada?, activa? }` (ítem G-1) — catálogo de plantillas de horario reutilizables, **referencia viva**: editar sus `dias` cambia el horario efectivo de todos los empleados asignados |
| GET | `/api/nomina/plantillas-horario?activa=true` | `rrhh.ver` — incluye `dias` |
| GET | `/api/nomina/plantillas-horario/:id` | `rrhh.ver` |
| PATCH | `/api/nomina/plantillas-horario/:id` | `rrhh.editar` — `predeterminada: true` desmarca automáticamente cualquier otra plantilla del tenant |
| PUT | `/api/nomina/plantillas-horario/:id/dias` | `rrhh.editar` — reemplaza los días completos de la plantilla, mismo contrato que `PUT .../horario` individual |
| GET | `/api/nomina/asistencia/mi-estado-hoy` | Autoservicio, sin permiso — `{ tieneEmpleado, registro }` del usuario logueado (RRHH, Fase 7b) |
| POST | `/api/nomina/asistencia/marcar-entrada` | Autoservicio, sin permiso — 400 si el usuario no tiene `Empleado.userId` vinculado o si ya marcó entrada hoy |
| POST | `/api/nomina/asistencia/marcar-salida` | Autoservicio, sin permiso — 400 si no marcó entrada hoy o si ya marcó salida; calcula `salidaAnticipada`/`horasExtra` (ítem G-4) contra `HorarioEmpleado` del día y `Configuracion.ASISTENCIA_UMBRAL_HORAS_EXTRA`/`ASISTENCIA_TOLERANCIA_SALIDA_ANTICIPADA_MIN` |
| POST | `/api/nomina/asistencia` | `rrhh.editar` — registro manual (`{ empleadoId, fecha, horaEntrada?, horaSalida? }`), para empleados sin login o corregir un olvido |
| GET | `/api/nomina/asistencia?empleadoId&desde&hasta&estado&pagina&tamanoPagina` | `rrhh.ver` — `estado` (ítem G-3) filtra `PENDIENTE`/`APROBADO`/`RECHAZADO` |
| PATCH | `/api/nomina/asistencia/:id/estado` | `rrhh.aprobar` — `{ estado: APROBADO\|RECHAZADO }` (ítem G-3), 400 si no está en `PENDIENTE`; puramente de revisión/auditoría — no afecta nómina |
| POST | `/api/nomina/ausencias` | `rrhh.editar` — crea en `SOLICITADA` (`{ empleadoId, tipo, fechaDesde, fechaHasta, conGoceDeSueldo?, motivo? }`, RRHH Fase 7c). Ítem G-2: 400 si el tipo está desactivado en `TipoAusenciaConfig` o excede su `maximoDiasPorAnio` (no aplica a VACACIONES, que sigue el balance legal); si `requiereAprobacion: false` para el tipo, se crea directo en `APROBADA` |
| GET | `/api/nomina/ausencias?empleadoId&estado&pagina&tamanoPagina` | `rrhh.ver` |
| GET | `/api/nomina/ausencias/:id` | `rrhh.ver` |
| PATCH | `/api/nomina/ausencias/:id/estado` | `rrhh.aprobar` — `{ estado: APROBADA\|RECHAZADA }`, 400 si no está en SOLICITADA |
| GET | `/api/nomina/tipos-ausencia` | `rrhh.ver` — ítem G-2, las 6 filas fijas de `TipoAusenciaConfig` (una por valor del enum `TipoAusencia`) |
| PATCH | `/api/nomina/tipos-ausencia/:tipo` | `rrhh.editar` — `{ maximoDiasPorAnio?, conGoceDeSueldoPorDefecto?, requiereAprobacion?, activo? }`; `maximoDiasPorAnio` se ignora para `VACACIONES` (siempre queda `null`, usa el balance legal) |
| GET | `/api/nomina/empleados/:id/balance-vacaciones` | `rrhh.ver` — `{ aniosCompletos, diasAcumulados, diasDisponibles, diasPagoPorAntiguedad }` (RRHH, Fase 7d) |
| POST | `/api/nomina/feriados` | `rrhh.editar` — `{ nombre, fecha, recurrenteAnual?, activo? }` — calendario de feriados (ítem G-5), catálogo puro sin efecto automático en tardanza/horas extra/nómina todavía |
| GET | `/api/nomina/feriados?activo=true` | `rrhh.ver` |
| PATCH | `/api/nomina/feriados/:id` | `rrhh.editar` |
| DELETE | `/api/nomina/feriados/:id` | `rrhh.editar` |

## POS

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/pos/turnos` | `pos.editar` — abre un turno (`{ bodegaId, montoInicial, cajaId? }`); 400 si esa bodega ya tiene uno ABIERTO; 403 (Fase 9) si la bodega es de una sucursal no asignada al usuario; `cajaId` (ítem E-7, opcional) 400 si la Caja no pertenece a `bodegaId` |
| GET | `/api/pos/turnos?pagina&tamanoPagina&cajeroId&estado&desde&hasta&busqueda` | `pos.ver` — `estado` acepta `PENDIENTE_REVISION` (ítem E-6) además de `ABIERTO`/`CERRADO` |
| GET | `/api/pos/turnos/reporte-cierres?desde&hasta&cajeroId&bodegaId` | `pos.ver` (ítem E-6) — reporte-dashboard de cierres: `{ totalVentas, cantidadSesiones, sobrantes: {cantidad, monto}, faltantes: {cantidad, monto}, exactas, diferenciaTotal }`, sobre turnos `CERRADO`/`PENDIENTE_REVISION` (los únicos con `diferencia` calculada) en el rango |
| GET | `/api/pos/cajeros` | `pos.ver` — cajeros distintos que han tenido al menos un turno, sin exigir `admin.usuarios` |
| GET | `/api/pos/vendedores?busqueda` | `pos.ver` — `Empleado` activos con cargo "Vendedor" (texto libre, no relacionado a `User`); sin exigir `nomina.ver` ni el módulo Nómina activo |
| GET | `/api/pos/turnos/:id` | `pos.ver` — incluye movimientos y facturas del turno, con `pagosVenta.formaPago.{id,nombre,esEfectivo}` (ítem E-6, antes solo `esEfectivo`) para armar el desglose por TODAS las formas de pago |
| POST | `/api/pos/turnos/:id/movimientos` | `pos.editar` — entrada/salida de efectivo que no es una venta (`{ tipo: ENTRADA\|SALIDA, monto, motivoTipo, concepto? }`); `motivoTipo` (plan de integración Cuadre, ítem F-5) es un enum obligatorio — `FONDO_CAMBIO`/`DEPOSITO`/`CORRECCION`/`OTRO` — y `concepto` (texto libre) pasó a opcional, se completa con la etiqueta legible del motivo si se omite |
| POST | `/api/pos/turnos/:id/cerrar` | `pos.editar` — `{ montoFinalContado, justificacionDiferencia?, pin? }`, calcula `montoEsperado`/`diferencia`; `pin` (Fase 9) requerido solo si el usuario tiene uno configurado Y (la diferencia supera la tolerancia O se cierra el turno de otro cajero). Ítem E-6: si la diferencia supera la tolerancia, el turno queda `PENDIENTE_REVISION` en vez de `CERRADO` directo |
| PATCH | `/api/pos/turnos/:id/revisar` | `pos.supervisar` (ítem E-6) — `PENDIENTE_REVISION → CERRADO`; 400 si el turno no está en `PENDIENTE_REVISION` |
| POST | `/api/pos/cotizar` | `pos.editar` — previsualización de solo lectura (`{ clienteId, lineas, listaPrecio? }`, mismo shape de líneas que `/pos/ventas`), sin `turnoCajaId` ni `pagos`: devuelve `{ lineas, subtotal, descuento, itbis, total }` ya con ofertas/nivel de precio resueltos, sin tocar stock/NCF/pagos. El checkout del POS la llama antes de armar los pagos para no cobrar sobre un estimado del navegador que ignora ofertas (Fase 4c — ver ARCHITECTURE.md) |
| POST | `/api/pos/ventas` | `pos.editar` — venta contra la bodega del turno (`{ turnoCajaId, clienteId, vendedorEmpleadoId?, listaPrecio?, tipoFactura?, tipoComprobanteEspecial?, pagos: [{formaPagoId, monto, referencia?}], lineas }`); soporta pago dividido (uno o más pagos que sumen exacto el total); `listaPrecio` sobreescribe el nivel de precio resuelto del cliente para esta venta puntual; `tipoFactura` (plan de integración Cuadre, ítem F-2) default `CONTADO` si se omite — solo `CONTADO`/`CREDITO`, nunca `NOTA_CREDITO`/`NOTA_DEBITO` (eso es `registrarDevolucion`); `tipoComprobanteEspecial` igual que en Facturación (ítem B-1); genera su asiento contable automático igual que cualquier factura; 400 (ítem E-7) si el turno tiene una `cajaId` asignada y alguna línea es de un producto/categoría no permitido en esa Caja |
| POST | `/api/pos/devoluciones/solicitar-autorizacion` | `facturacion.anular` (ítem D-1) — `{ facturaOrigenId, turnoCajaId }`; mismo mecanismo que `/facturas/:id/solicitar-autorizacion` |
| POST | `/api/pos/devoluciones` | `facturacion.anular` — devolución parcial (`{ facturaOrigenId, turnoCajaId, formaPagoId, referenciaPago?, lineas: [{productoId, cantidad}], codigoAutorizacion? }`); emite una NOTA_CREDITO, 400 si la cantidad excede lo disponible; `codigoAutorizacion` (ítem D-1) requerido solo si el tenant activó `AUTORIZACION_2FA_DEVOLUCION` |
| GET | `/api/pos/facturas/:id/devolucion` | `facturacion.anular` (no `facturacion.ver` — Cajero/Vendedor no lo tienen) — detalle de una factura con lo disponible por producto, para armar la Devolución |
| POST | `/api/pos/turnos/:id/guardar` | `pos.editar` — aparca el carrito actual (`{ clienteId?, vendedorEmpleadoId?, nota?, lineas: [{productoId, cantidad, precioUnitario, porcentajeItbis, descuento?}] }`), snapshot de precio/ITBIS al momento de guardar |
| GET | `/api/pos/turnos/:id/guardadas` | `pos.editar` — ventas aparcadas de este turno |
| DELETE | `/api/pos/ventas-aparcadas/:id` | `pos.editar` — se llama al recuperar una (o para descartarla) |
| GET | `/api/pos/mensaje-cajas` | `pos.ver` — "Mensaje a cajas" (ítem J-3), `{ texto, fecha } \| null`; en Redis, TTL 8h, sin historial |
| POST | `/api/pos/mensaje-cajas` | `pos.supervisar` — `{ texto }` (máx. 280 caracteres) — publica/reemplaza el aviso |
| DELETE | `/api/pos/mensaje-cajas` | `pos.supervisar` — borra el aviso activo |

## Cajas (ítem E-7)

"Caja" es una terminal física de POS, distinta de `Bodega` (el local) y
de `TurnoCaja` (una jornada de un cajero) — restringe qué puede vender
esa terminal. Ver "Cajas — restricción de catálogo por terminal" en
ARCHITECTURE.md.

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/cajas` | `pos.supervisar` — `{ bodegaId, codigo, nombre, activa?, categoriaIds?, productoIds?, favoritoIds? }`; sin `categoriaIds` ni `productoIds`, la Caja vende el catálogo completo |
| GET | `/api/cajas` | `pos.ver` — todas las cajas del tenant, con `categorias`/`productos`/`favoritos` ya resueltos (nombre incluido) |
| GET | `/api/cajas/:id` | `pos.ver` |
| PATCH | `/api/cajas/:id` | `pos.supervisar` — `categoriaIds`/`productoIds`/`favoritoIds` reemplazan por completo la asignación existente (mismo patrón que `componentes` de un Producto COMBO); `undefined` deja la lista actual tal cual, `[]` la vacía |
| DELETE | `/api/cajas/:id` | `pos.supervisar` — los turnos históricos que la usaban quedan con `cajaId: null` (no se borran) |

## Tasas de cambio (ítem C-2, multi-moneda)

Catálogo manual, sin feed automático (mismo criterio que Cuadre). Solo
afecta la PRESENTACIÓN de una venta — nunca los precios/costos del
catálogo, que siguen siempre en DOP. Ver "Multi-moneda" en
ARCHITECTURE.md.

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/tasas-cambio` | `admin.configuracion` — `{ moneda, tasa }`; `moneda` código ISO de 3 letras (ej. `USD`), `tasa` = cuántos DOP vale 1 unidad de esa moneda (ej. `58.5`); 400 si ya existe una tasa para esa moneda (editarla, no duplicarla) |
| GET | `/api/tasas-cambio` | `facturacion.crear` — sin permiso más restrictivo a propósito: cualquiera que factura necesita ver qué monedas están configuradas |
| PATCH | `/api/tasas-cambio/:id` | `admin.configuracion` |
| DELETE | `/api/tasas-cambio/:id` | `admin.configuracion` |

`POST /api/facturas` gana `moneda?` (código ISO, ej. `"USD"`) — si se
omite o es `"DOP"`, sin cambios de comportamiento. Con otra moneda:
400 si no hay una `TasaCambio` configurada; si la hay, la `Factura`
persiste `moneda`, `tasaCambio` (snapshot de la tasa vigente al momento
de la venta — no cambia si la tasa se actualiza después) y
`subtotalMoneda`/`itbisMoneda`/`totalMoneda` (equivalente para el
documento impreso). `subtotal`/`itbis`/`total` siguen siendo SIEMPRE
DOP — NCF, contabilidad, reportes, pagos y el dashboard no cambian.

## IA

**Sin `ANTHROPIC_API_KEY` configurada, cada endpoint degrada a un modo
heurístico sin IA (ver ARCHITECTURE.md) — no falla, responde con
`generadaConIa: false` o (para sugerir-cuenta-contable) posiblemente
`null`.**

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/ia/asistente` | `ia.usar` — `{ pregunta }`, responde con contexto real del dashboard del tenant |
| POST | `/api/ia/sugerir-cuenta-contable` | `ia.usar` — `{ concepto }`, devuelve `{ codigo, nombre, fuente: IA\|HEURISTICA }` o `null` |
| POST | `/api/ia/generar-descripcion-producto` | `ia.usar` — `{ nombre, categoria? }` |

## Reportes fiscales DGII

**Layout preliminar, no verificado byte a byte contra la DGII — ver
ARCHITECTURE.md antes de usar en producción.**

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/reportes-fiscales/606?desde&hasta` | `reportes.ver` — compras recibidas en el rango (default: mes actual) |
| GET | `/api/reportes-fiscales/606/exportar?desde&hasta&formato=txt\|json` | `reportes.ver` — `.txt` delimitado por `\|`, default |
| GET | `/api/reportes-fiscales/607?desde&hasta` | `reportes.ver` — ventas (facturas EMITIDA) en el rango |
| GET | `/api/reportes-fiscales/607/exportar?desde&hasta&formato=txt\|json` | `reportes.ver` |
| GET | `/api/reportes-fiscales/608?desde&hasta` | `reportes.ver` — comprobantes anulados en el rango |
| GET | `/api/reportes-fiscales/608/exportar?desde&hasta&formato=txt\|json` | `reportes.ver` |
| GET | `/api/reportes-fiscales/itbis-resumen?desde&hasta` | `reportes.ver` — `{ itbisEnVentas, itbisEnCompras, itbisNetoAPagar }` |

Las respuestas de `/admin/usuarios` nunca incluyen `passwordHash` — el
repositorio usa `select` explícito, no `include`, precisamente para no
filtrarlo por accidente.
