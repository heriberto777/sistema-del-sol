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
| GET | `/api/admin/ncf` | `admin.configuracion` |
| POST | `/api/admin/ncf` | `admin.configuracion` — `{ tipoNcf, secuenciaInicial?, secuenciaFinal, vigenciaHasta }` |
| PATCH | `/api/admin/ncf/:tipoNcf` | `admin.configuracion` — `{ secuenciaFinal?, vigenciaHasta?, activo? }` |

## Formas de pago (por tenant — catálogo configurable, reemplaza el enum fijo)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/formas-pago?activa=true` | sin permiso — cualquier usuario autenticado (POS/Cobranza/Compras necesitan leer el catálogo) |
| POST | `/api/formas-pago` | `admin.configuracion` — `{ nombre, requiereReferencia?, esEfectivo?, esBono?, activa? }` |
| PATCH | `/api/formas-pago/:id` | `admin.configuracion` — parcial; `esEfectivo: true` desmarca automáticamente cualquier otra forma de pago del tenant |

## Facturación

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/facturas` | `facturacion.crear` — `{ clienteId, bodegaId, tipoFactura, lineas[], facturaOrigenId?, listaPrecio? }`; `facturaOrigenId` requerido para `NOTA_CREDITO`/`NOTA_DEBITO`; `listaPrecio` (nombre de `ListaPrecio`, no id) sobreescribe el nivel de precio resuelto del cliente para esta venta puntual — ver ARCHITECTURE.md, "Precios multinivel"; 403 (Fase 9) si la bodega es de una sucursal no asignada al usuario (cubre también POS y conversión de Cotizaciones/Remisiones, que reusan este mismo endpoint internamente) |
| GET | `/api/facturas?pagina&tamanoPagina&busqueda&tipoFactura` | `facturacion.ver` — `busqueda` filtra por NCF o nombre de cliente; `tipoFactura` (repetible: `?tipoFactura=NOTA_CREDITO&tipoFactura=NOTA_DEBITO`) filtra por tipo — usado por la pantalla de Notas de Crédito/Débito (Fase 4a de adopción de Cuadre) |
| GET | `/api/facturas/:id` | `facturacion.ver` |
| POST | `/api/facturas/:id/anular` | `facturacion.anular` — `{ motivo, pin? }` (Fase 9, `pin` requerido solo si el usuario tiene uno configurado); reversa el efecto de inventario (ver ARCHITECTURE.md); 400 si ya estaba anulada; 403 si la bodega de la factura es de una sucursal no asignada al usuario; si la factura es de POS y quien pide la anulación no tiene `pos.supervisar`, 403 salvo que sea el mismo cajero del turno Y siga `ABIERTO` (ver "Roles de POS" en ARCHITECTURE.md) |
| POST | `/api/facturas/:id/pagos` | `facturacion.cobrar` — `{ monto, formaPagoId, referencia?, fecha? }`; pagos parciales soportados, marca `pagada: true` al cubrir el total; 400 si el monto excede el saldo pendiente |
| GET | `/api/facturas/:id/pagos` | `facturacion.ver` — `{ pagos, totalPagado }` |
| GET | `/api/facturas/:id/imprimir?formato=CARTA\|A4\|TERMICA_80MM\|TERMICA_58MM` | `facturacion.imprimir` — sin `formato`, resuelve el default (override de bodega > default de tenant > CARTA, ver ARCHITECTURE.md); devuelve PDF o HTML según formato. Separado de `facturacion.ver` para que Vendedor pueda imprimir un recibo de POS sin ver la pantalla general de Facturación |

## Ofertas (Fase 4b de adopción de Cuadre)

Descuentos automáticos, resueltos al facturar/cotizar (ver
ARCHITECTURE.md) — este CRUD solo administra el catálogo, la resolución
en sí no es un endpoint propio.

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/ofertas` | `ofertas.editar` — `{ nombre, tipoDescuento: PORCENTAJE\|MONTO_FIJO, valor, alcance: PRODUCTO\|CATEGORIA\|CARRITO, productoId?, categoriaId?, montoMinimoCarrito?, fechaInicio, fechaFin }`; `productoId`/`categoriaId`/`montoMinimoCarrito` son mutuamente exclusivos según `alcance` (400 si no corresponden) |
| GET | `/api/ofertas` | `ofertas.ver` |
| PATCH | `/api/ofertas/:id` | `ofertas.editar` — mismas reglas de exclusividad que crear |
| DELETE | `/api/ofertas/:id` | `ofertas.editar` |

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
| POST | `/api/productos` | `precios.editar` — acepta `imagen` (data URI, opcional) |
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
| POST | `/api/categorias` | `precios.editar` — `{ nombre, categoriaPadreId? }` |
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
| GET | `/api/inventario/kardex/:varianteId?bodegaId&desde&hasta` | `inventario.ver` — historial cronológico con saldo corriente (Fase 5a); sin `desde`/`hasta`, default mes actual (mismo criterio que `libro-mayor`); sin paginar — devuelve `{ variante, bodegaId, rango, saldoInicial, movimientos, saldoFinal }` |
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
| POST / PATCH | `/api/clientes` | `clientes.*` — acepta `listaPrecioId` (FK a `ListaPrecio`, `null` explícito quita la asignación) |
| GET | `/api/clientes?pagina&tamanoPagina&busqueda` | `clientes.ver` — `busqueda` filtra por nombre, email o RNC/cédula |
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
| GET | `/api/reportes/dashboard?sucursalId` | `reportes.ver` — `{ ventasHoyTotal, facturasHoyCantidad, productosStockBajo, ordenesCompraPendientes }`, cacheado en Redis 30s por tenant+sucursal. `sucursalId` opcional (Fase 8d) filtra los primeros 3 KPIs; `ordenesCompraPendientes` siempre tenant-wide (`OrdenCompra` no tiene `bodegaId` propio) |
| GET | `/api/reportes/ventas?desde&hasta` | `reportes.ver` — facturas emitidas en el rango (default: últimos 30 días) + resumen |
| GET | `/api/reportes/ventas/exportar?desde&hasta&formato=xlsx\|pdf` | `reportes.ver` — descarga binaria (`.xlsx` real vía exceljs, `.pdf` real vía pdfkit) |
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
| GET | `/api/nomina/empleados?pagina&tamanoPagina&busqueda` | `nomina.ver` — busca por nombre/cédula/cargo |
| GET | `/api/nomina/empleados/:id` | `nomina.ver` |
| POST | `/api/nomina/empleados` | `nomina.editar` |
| PATCH | `/api/nomina/empleados/:id` | `nomina.editar` — enviar `fechaSalida` desactiva al empleado automáticamente |
| GET | `/api/nomina/periodos?pagina&tamanoPagina` | `nomina.ver` |
| GET | `/api/nomina/periodos/:id` | `nomina.ver` — incluye los recibos con su empleado |
| POST | `/api/nomina/periodos` | `nomina.editar` — genera recibos para todos los empleados activos (`{ tipo: QUINCENAL\|MENSUAL, fechaInicio, fechaFin }`) |
| POST | `/api/nomina/periodos/:id/procesar` | `nomina.editar` — `BORRADOR → PROCESADO`, 400 si ya no está en BORRADOR |
| POST | `/api/nomina/periodos/:id/marcar-pagado` | `nomina.editar` — `PROCESADO → PAGADO`, dispara el asiento contable automático (ver ARCHITECTURE.md) |
| GET | `/api/nomina/empleados/:empleadoId/horario` | `rrhh.ver` — horario semanal (RRHH, Fase 7a) |
| PUT | `/api/nomina/empleados/:empleadoId/horario` | `rrhh.editar` — reemplaza el horario completo (`{ dias: [{ diaSemana, horaEntrada, horaSalida }] }`, `dias: []` lo deja sin ningún día configurado) |
| GET | `/api/nomina/asistencia/mi-estado-hoy` | Autoservicio, sin permiso — `{ tieneEmpleado, registro }` del usuario logueado (RRHH, Fase 7b) |
| POST | `/api/nomina/asistencia/marcar-entrada` | Autoservicio, sin permiso — 400 si el usuario no tiene `Empleado.userId` vinculado o si ya marcó entrada hoy |
| POST | `/api/nomina/asistencia/marcar-salida` | Autoservicio, sin permiso — 400 si no marcó entrada hoy o si ya marcó salida |
| POST | `/api/nomina/asistencia` | `rrhh.editar` — registro manual (`{ empleadoId, fecha, horaEntrada?, horaSalida? }`), para empleados sin login o corregir un olvido |
| GET | `/api/nomina/asistencia?empleadoId&desde&hasta&pagina&tamanoPagina` | `rrhh.ver` |
| POST | `/api/nomina/ausencias` | `rrhh.editar` — crea en `SOLICITADA` (`{ empleadoId, tipo, fechaDesde, fechaHasta, conGoceDeSueldo?, motivo? }`, RRHH Fase 7c) |
| GET | `/api/nomina/ausencias?empleadoId&estado&pagina&tamanoPagina` | `rrhh.ver` |
| GET | `/api/nomina/ausencias/:id` | `rrhh.ver` |
| PATCH | `/api/nomina/ausencias/:id/estado` | `rrhh.aprobar` — `{ estado: APROBADA\|RECHAZADA }`, 400 si no está en SOLICITADA |
| GET | `/api/nomina/empleados/:id/balance-vacaciones` | `rrhh.ver` — `{ aniosCompletos, diasAcumulados, diasDisponibles, diasPagoPorAntiguedad }` (RRHH, Fase 7d) |

## POS

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/pos/turnos` | `pos.editar` — abre un turno (`{ bodegaId, montoInicial }`); 400 si esa bodega ya tiene uno ABIERTO; 403 (Fase 9) si la bodega es de una sucursal no asignada al usuario |
| GET | `/api/pos/turnos?pagina&tamanoPagina` | `pos.ver` |
| GET | `/api/pos/cajeros` | `pos.ver` — cajeros distintos que han tenido al menos un turno, sin exigir `admin.usuarios` |
| GET | `/api/pos/vendedores?busqueda` | `pos.ver` — `Empleado` activos con cargo "Vendedor" (texto libre, no relacionado a `User`); sin exigir `nomina.ver` ni el módulo Nómina activo |
| GET | `/api/pos/turnos/:id` | `pos.ver` — incluye movimientos y facturas del turno |
| POST | `/api/pos/turnos/:id/movimientos` | `pos.editar` — entrada/salida de efectivo que no es una venta (`{ tipo: ENTRADA\|SALIDA, monto, motivoTipo, concepto? }`); `motivoTipo` (plan de integración Cuadre, ítem F-5) es un enum obligatorio — `FONDO_CAMBIO`/`DEPOSITO`/`CORRECCION`/`OTRO` — y `concepto` (texto libre) pasó a opcional, se completa con la etiqueta legible del motivo si se omite |
| POST | `/api/pos/turnos/:id/cerrar` | `pos.editar` — `{ montoFinalContado, justificacionDiferencia?, pin? }`, calcula `montoEsperado`/`diferencia`; `pin` (Fase 9) requerido solo si el usuario tiene uno configurado Y (la diferencia supera la tolerancia O se cierra el turno de otro cajero) |
| POST | `/api/pos/cotizar` | `pos.editar` — previsualización de solo lectura (`{ clienteId, lineas, listaPrecio? }`, mismo shape de líneas que `/pos/ventas`), sin `turnoCajaId` ni `pagos`: devuelve `{ lineas, subtotal, descuento, itbis, total }` ya con ofertas/nivel de precio resueltos, sin tocar stock/NCF/pagos. El checkout del POS la llama antes de armar los pagos para no cobrar sobre un estimado del navegador que ignora ofertas (Fase 4c — ver ARCHITECTURE.md) |
| POST | `/api/pos/ventas` | `pos.editar` — venta CONTADO contra la bodega del turno (`{ turnoCajaId, clienteId, vendedorEmpleadoId?, listaPrecio?, pagos: [{formaPagoId, monto, referencia?}], lineas }`); soporta pago dividido (uno o más pagos que sumen exacto el total); `listaPrecio` sobreescribe el nivel de precio resuelto del cliente para esta venta puntual; genera su asiento contable automático igual que cualquier factura |
| POST | `/api/pos/devoluciones` | `facturacion.anular` — devolución parcial (`{ facturaOrigenId, turnoCajaId, formaPagoId, referenciaPago?, lineas: [{productoId, cantidad}] }`); emite una NOTA_CREDITO, 400 si la cantidad excede lo disponible |
| GET | `/api/pos/facturas/:id/devolucion` | `facturacion.anular` (no `facturacion.ver` — Cajero/Vendedor no lo tienen) — detalle de una factura con lo disponible por producto, para armar la Devolución |
| POST | `/api/pos/turnos/:id/guardar` | `pos.editar` — aparca el carrito actual (`{ clienteId?, vendedorEmpleadoId?, nota?, lineas: [{productoId, cantidad, precioUnitario, porcentajeItbis, descuento?}] }`), snapshot de precio/ITBIS al momento de guardar |
| GET | `/api/pos/turnos/:id/guardadas` | `pos.editar` — ventas aparcadas de este turno |
| DELETE | `/api/pos/ventas-aparcadas/:id` | `pos.editar` — se llama al recuperar una (o para descartarla) |

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
