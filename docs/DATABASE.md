# Base de datos

PostgreSQL 16 + Prisma. Schema completo en `backend/prisma/schema.prisma`.

## Convenciones

- Nombres de tabla en snake_case en español (`facturas`, `linea_factura`,
  `movimiento_inventario`...) vía `@@map` — los modelos de Prisma quedan
  en PascalCase para el cliente TypeScript.
- Toda tabla de negocio que pertenece a un tenant lleva una columna
  `tenantId` y está listada en
  `backend/src/prisma/tenant-scoped-models.ts` para el aislamiento
  automático (ver ARCHITECTURE.md). Las tablas "hijas" que cuelgan de una
  tabla ya scoped (`linea_factura`, `precios`, `stock`, `linea_oc`,
  `linea_recepcion`) **no** llevan `tenantId` propio — su aislamiento
  viene de la relación con el padre, pero **solo si se llega a ellas a
  través de una consulta ya scoped sobre el padre** (p. ej. `factura.
  findUniqueOrThrow({where:{id}, include:{lineas:true}})`). Si en cambio
  se consulta la tabla hija directamente por un id del padre que viene del
  cliente (`stock.findMany({where:{bodegaId}})`,
  `precio.findFirst({where:{productoId}})`), **no hay ningún filtro
  automático** — hay que validar a mano que ese id pertenezca al tenant
  antes de tocar la tabla hija (ver `InventarioService.validarPertenencia`/
  `PreciosService`, que hacen exactamente eso resolviendo el
  padre — `Producto`/`Bodega`, que sí son tenant-scoped — vía
  `TenantPrismaService` antes de leer/escribir `Stock`/`Precio`). Fue un
  IDOR real (cualquier `bodegaId`/`productoId` adivinado de otro tenant
  filtraba o permitía corromper su stock/precios) hasta que se corrigió.

## Módulos y tablas

| Módulo | Tablas |
|---|---|
| Core / tenants | `tenants`, `tenant_settings`, `configuraciones` |
| Planes / módulos | `planes`, `modulos`, `plan_modulos` (catálogo global, sin `tenantId`), `tenant_modulo_overrides` (tenant-scoped) |
| Usuarios / RBAC | `users`, `roles`, `permissions`, `role_permissions`, `user_roles` |
| Auditoría | `audit_logs` (tenant), `platform_audit_logs` (plataforma, sin `tenantId`) |
| Facturación | `ncf_asignados`, `facturas`, `linea_factura` |
| Cotizaciones / Remisiones | `cotizaciones`, `linea_cotizacion`, `remisiones`, `linea_remision` |
| Productos / precios | `productos`, `precios` (cuelga de `variantes_producto`, no de `productos`), `componentes_combo`, `categorias` (jerarquía real vía `categoriaPadreId`, self-relation — mismo patrón que `cuentas_contables.cuentaPadreId`), `listas_precio` (catálogo de niveles de precio, sin FK desde `precios.listaPrecio`), `variantes_producto`/`atributos`/`valores_atributo`/`valores_atributo_variante` (SKU real, Fase 3c — ver ARCHITECTURE.md), `ofertas` (descuentos automáticos por producto/categoría/carrito, Fase 4b — ver ARCHITECTURE.md) |
| Inventario | `bodegas` (cuelga de `sucursales`, Fase 8a), `stock` (cuelga de `variantes_producto`), `movimiento_inventario` (conserva `productoId` denormalizado + `varianteId` como FK real), `lotes` (control de vencimiento por variante+bodega, opt-in vía `productos.controlaVencimiento`, Fase 5b — ver ARCHITECTURE.md) |
| Sucursales | `sucursales` (locales físicos, Fase 8 — ver ARCHITECTURE.md) |
| Compras | `proveedores`, `orden_compra`, `linea_oc`, `recepcion_compra`, `linea_recepcion` |
| Clientes | `clientes`, `direccion_cliente` |
| Webhooks | `webhooks`, `webhook_deliveries` |
| Notificaciones | `notificacion_plantillas`, `notificaciones` |
| Contabilidad | `cuentas_contables`, `asientos_contables`, `lineas_asiento` |
| Bancos / Gastos menores | `cuentas_bancarias`, `gastos_menores`, `lineas_gasto_menor` |
| Nómina | `empleados`, `periodos_nomina`, `recibos_nomina` |
| POS | `turnos_caja`, `movimientos_caja`, `ventas_aparcadas`/`lineas_venta_aparcada`, `pagos_venta` (ledger de pago dividido, hija de `facturas` sin tenantId propio) (+ `facturas.formaPagoId`/`facturas.turnoCajaId`/`facturas.vendedorEmpleadoId`) |
| Formas de pago | `formas_pago` (tenant-scoped, reemplaza el enum fijo `MetodoPago` para `facturas`/`pagos` — ese enum sigue existiendo solo para `PagoPlataforma`; `esBono: Boolean` identifica la forma "Bono" igual que `esEfectivo`, Fase 4c — ver ARCHITECTURE.md) |
| Bonos | `bonos` (tenant-scoped, gift cards; `saldoActual` es la única fuente de verdad, sin tabla de movimientos propia — `pagos_venta` filtrado por `formaPago.esBono` ya sirve de ledger, Fase 4c — ver ARCHITECTURE.md) |
| Plataforma | `platform_admins`, `platform_audit_logs` |
| RBAC de plataforma | `platform_permissions`, `platform_roles`, `platform_role_permissions` (catálogo global, sin `tenantId` — `platform_admins.roleId` es nullable) |
| Suscripción/facturación de plataforma | `suscripciones`, `facturas_plataforma`, `pagos_plataforma` (tienen `tenantId` pero fuera de `TENANT_SCOPED_MODELS`/RLS — solo se acceden vía `PrismaService` raw desde controllers de plataforma, igual criterio que `Modulo`/`Plan`) |

`users` y `platform_admins` tienen `resetPasswordTokenHash`/
`resetPasswordExpiraEn` (ambos nullable) para el flujo de "olvidé mi
contraseña" — ver ARCHITECTURE.md. Se limpian (`null`) al canjear el
token, así que un token nunca puede reusarse.

## Reglas de negocio relevantes al modelo

- **NCF**: `ncf_asignados` guarda, por tenant y tipo (`B01` Crédito Fiscal,
  `B02` Consumo, `B03` Nota de Débito, `B04` Nota de Crédito, `B14`/`B15`
  regímenes especiales), un rango `secuenciaActual..secuenciaFinal` con
  vigencia. `FacturacionRepository.siguienteNcf` toma el próximo número
  con un `UPDATE ... SET secuenciaActual = secuenciaActual + 1`
  (`{ increment: 1 }` de Prisma) — la transacción sola NO evitaba
  duplicados (ver ARCHITECTURE.md, "Concurrencia y atomicidad"); el
  incremento relativo sí, porque Postgres lo resuelve contra el valor
  real de la fila en el momento del `UPDATE`, no contra un valor leído
  antes en JS.
- **Precios**: `precios` es un historial — cada cambio cierra el registro
  vigente (`vigenteHasta = now()`) y crea uno nuevo con `vigenteHasta:
  null`. La vigente es siempre `WHERE vigenteHasta IS NULL`.
- **Niveles de precio (Fase 3b de adopción de Cuadre)**: `precios.listaPrecio`
  sigue siendo un `String` libre (default `"GENERAL"`), **sin FK** —
  `listas_precio` es solo un catálogo de UI (selectores del formulario de
  Precio, `clientes.listaPrecioId`, override manual al facturar) que debe
  usar exactamente los mismos nombres. `clientes.listaPrecioId` (`onDelete:
  SetNull`) resuelve el nivel por defecto de cada venta;
  `FacturacionService.crear()`/`CotizacionesService.crear()` lo leen del
  cliente y lo pueden sobreescribir con `dto.listaPrecio` explícito
  (prioridad: override > cliente > `"GENERAL"`). `ListasPrecioService.
  actualizar()` rechaza renombrar la fila `"GENERAL"` — es el default
  hardcodeado en el schema y en varios services, renombrarla dejaría los
  precios ya creados con esa lista inalcanzables desde el catálogo.
- **Stock**: `stock.cantidadActual - stock.cantidadReservada` es el
  disponible; nunca se permite que una venta lo deje negativo
  (`InventarioService.verificarYDescontarStock`). Cada movimiento queda
  también en `movimiento_inventario` (ENTRADA/SALIDA/TRANSFERENCIA/AJUSTE).
  `movimiento_inventario.direccion` (`ENTRADA`/`SALIDA`, Fase 5a) es el
  signo real del movimiento — `cantidad` siempre se guarda en valor
  absoluto, y `tipo` solo no alcanza para saber el signo de
  `TRANSFERENCIA`/`AJUSTE` (ver ARCHITECTURE.md, "Kardex").
- **Variantes de producto (Fase 3c)**: `stock`/`precios` cuelgan de
  `variantes_producto`, no de `productos` directo — todo producto tiene
  siempre al menos una variante "por defecto" (sin valores de atributo),
  para que un producto sin atributos reales siga teniendo exactamente
  una fila de stock/precio. `movimiento_inventario.productoId` se
  conserva (denormalizado, de solo lectura); `varianteId` es la FK real.
  `VariantesService.generarCombinaciones` arma el producto cartesiano de
  `atributos`/`valores_atributo` elegidos y reemplaza TODAS las
  variantes del producto (borrar y recrear) — rechaza hacerlo si alguna
  variante actual ya tiene filas en `movimiento_inventario`
  (`onDelete: Restrict`, a propósito, a diferencia de `precios`/`stock`
  que cuelgan con `Cascade`). `valores_atributo` es una tabla "hija" sin
  tenantId propio (como `componentes_combo`) — su aislamiento depende de
  validar primero el `atributo` padre. Las líneas de venta/compra
  (`linea_factura`, `linea_cotizacion`, `linea_remision`, `linea_oc`,
  `linea_recepcion`, `linea_devolucion_compra`, `lineas_venta_aparcada`)
  también tienen `varianteId` (`NOT NULL`, FK `RESTRICT` — perder a qué
  variante corresponde una línea ya emitida sería perder historial
  real). `VariantesService.resolverObligatoria(productoId, varianteId?)`
  es el único punto que decide la variante de una línea: se resuelve
  sola si el producto tiene una única variante, exige `varianteId`
  explícito (400) si tiene varias, y lanza 404 si el producto no tiene
  ninguna (no existe, o es de otro tenant). `PreciosService` usa el
  mismo `resolverObligatoria` — un producto con variantes reales puede
  tener un `precios` distinto por variante (Talla/Color con precio
  propio), no solo por `listaPrecio`. `variantes_producto.codigoBarras`
  (Fase 3d, `@@unique([tenantId, codigoBarras])`) se edita vía `PATCH
  /productos/:productoId/variantes/:varianteId` y participa en la
  búsqueda de catálogo/POS (`ProductosRepository.whereBusqueda`).
- **`productos.tipo`** (`PRODUCTO`/`SERVICIO`/`COMBO`): un `SERVICIO`
  nunca tiene fila en `stock` (no mueve inventario al facturarse); un
  `COMBO` tampoco tiene fila propia — al facturarse expande a sus
  `componentes_combo` (cantidad de la línea × cantidad del componente) y
  descuenta stock de esos, nunca del combo. Un componente está
  restringido a `PRODUCTO`/`SERVICIO` (validado en `ProductosService`) —
  no se permiten combos anidados. Ver `FacturacionService.
  expandirParaInventario`, el único lugar que resuelve esto (Cotizaciones/
  Remisiones/POS lo heredan al convertir vía `FacturacionService.crear()`).
  `ComprasService` rechaza comprar un `COMBO` directamente y no mueve
  stock al recibir/devolver una línea `SERVICIO`.
- **Categorías**: `categorias.categoriaPadreId` es una self-relation real
  (`@relation("JerarquiaCategoria")`, mismo patrón que
  `cuentas_contables.cuentaPadreId`, hasta ahora sembrado pero sin
  explotar) — el listado se sirve plano (`GET /categorias`) y el cliente
  arma el árbol (`frontend/src/lib/categorias-arbol.ts`). Reasignar el
  padre de una categoría (`CategoriasService.actualizar`) valida que no
  se cree un ciclo, recorriendo hacia arriba la cadena de padres del
  candidato hasta encontrar la propia categoría (caso de rechazo) o la
  raíz (caso válido). Eliminar una categoría con productos o
  subcategorías asignadas se rechaza (400) — no hay cascada silenciosa.
  `productos.categoriaId` (`onDelete: SetNull`) reemplazó el antiguo
  `productos.categoria` (texto libre); el filtro de listado/catálogo por
  categoría es exacto, no incluye descendientes.
- **Compras**: `linea_oc.cantidadRecibida` se incrementa con cada
  `recepcion_compra`; la orden pasa a `RECIBIDA_TOTAL` cuando toda línea
  recibió >= lo pedido, o `RECIBIDA_PARCIAL` en caso contrario.
  `diferenciaVsFactura` (respuesta de `POST .../recibir`) compara
  `montoFacturaProveedor` contra el monto de **esta recepción específica**
  (`Σ cantidadRecibida × costoUnitario` de las líneas que se están
  recibiendo AHORA) — nunca contra `orden.total` (el total de toda la
  orden). Comparar contra el total completo fue un bug real: en una
  orden recibida en varios envíos, la factura del proveedor de un envío
  parcial nunca va a coincidir con el total pedido originalmente, así
  que esa comparación producía una "diferencia" sin sentido en cualquier
  recepción que no fuera la única y completa.
- **`facturas.bodegaId`** (nullable): de dónde se descontó/reintegró
  inventario al crearla — nullable porque las facturas de antes de esta
  columna no lo tienen; `anular()` simplemente no toca inventario si es
  `null` (dato legado) en vez de fallar.
- **`linea_cotizacion.productoId`/`linea_remision.productoId`** son
  `ON DELETE CASCADE` hacia `productos` — a diferencia de
  `linea_factura.productoId` (`RESTRICT`, preserva historial fiscal),
  porque cotizaciones/remisiones no son documentos fiscales. Ver el
  comentario en `schema.prisma` sobre por qué existe esta diferencia (una
  carrera real en el orden de cascada de Postgres al borrar un tenant
  completo, encontrada corriendo los e2e).
- **`recibos_nomina.empleadoId`** y **`lineas_asiento.cuentaContableId`**
  son `ON DELETE CASCADE` por la misma razón: son ramas hermanas desde
  `Tenant` que compiten al borrarlo completo (`Tenant -> Empleado` vs.
  `Tenant -> PeriodoNomina -> ReciboNomina`), y Postgres no garantiza el
  orden entre ramas hermanas.
- **`linea_oc.productoId`/`linea_recepcion.productoId`** son también
  `ON DELETE CASCADE` hacia `productos`, mismo patrón de ramas hermanas
  (`Tenant -> Producto` vs. `Tenant -> OrdenCompra -> LineaOc`) —
  encontrado recién al agregar cobertura e2e real para Compras (nadie
  había ejercitado ese camino de borrado antes).
- **`recepcion_compra.ordenCompraId`** es `ON DELETE CASCADE` hacia
  `orden_compra` por una razón ligeramente distinta: no es una carrera
  entre ramas hermanas, es que `RecepcionCompra` **no tiene relación
  directa con `Tenant`** (solo la columna `tenantId`, sin `@relation`) —
  la única forma de alcanzarla al borrar un tenant es transitivamente
  vía `OrdenCompra`, así que esa cascada debe declararse explícita o la
  cadena se detiene ahí y Postgres rechaza el borrado del tenant.
- **Los recibos de nómina no se recalculan si cambia el salario del
  empleado**: `salarioBrutoMensual` en `empleados` es el valor *vigente*;
  cada `ReciboNomina` congela el cálculo hecho al momento de generar el
  período. No hay historial de cambios de salario (a diferencia de
  `precios`) — si se necesita auditar aumentos salariales, es la
  extensión natural.
- **`empleados.userId`** (nullable, único) es `ON DELETE SET NULL` —
  borrar el `User` de login no debe borrar el historial de nómina del
  empleado, solo desvincularlo (RRHH, Fase 7a). `horarios_empleado`
  sigue el mismo patrón de rama hermana que `recibos_nomina`/
  `lineas_asiento` (`ON DELETE CASCADE` hacia `tenants` y hacia
  `empleados`) — la ausencia de una fila para un `diaSemana` dado
  significa que ese día no se trabaja, no hay columna booleana aparte.
- **`registros_asistencia`** (RRHH, Fase 7b) sigue el mismo patrón de
  rama hermana `ON DELETE CASCADE` que `horarios_empleado`.
  `@@unique([tenantId, empleadoId, fecha])` — una fila por empleado por
  día calendario, completada progresivamente (`horaEntrada` al marcar
  entrada, `horaSalida` después). `fecha` se guarda a medianoche UTC
  del día calendario de RD (no del servidor) — ver
  `zona-horaria-rd.util.ts` en ARCHITECTURE.md.
- **`ausencias.solicitadoPorId`/`aprobadoPorId`** (RRHH, Fase 7c) son
  `ON DELETE CASCADE` hacia `users` — mismo patrón de rama hermana que
  `turnos_caja.cajeroId`/`cerradoPorId`; `aprobadoPorId` es nullable y
  usa relación nombrada por la misma razón (dos FK al mismo modelo
  desde una sola tabla).
- **`recibos_nomina.descuentoAusencias`** (RRHH, Fase 7d, `@default(0)`)
  se muestra separado de `otrasDeducciones` en el recibo — mismo campo
  numérico, pero con una semántica contable distinta (ver
  ARCHITECTURE.md: no se agrupa con `otrasDeducciones` en el asiento
  automático porque no es una retención que se le deba a alguien).
- **`facturas.turnoCajaId`** es `ON DELETE SET NULL` (no `RESTRICT` ni
  `CASCADE`) — a diferencia de `recibos_nomina.empleadoId`/
  `lineas_asiento.cuentaContableId`, aquí el documento fiscal (`Factura`)
  debe sobrevivir siempre aunque el turno de caja que la originó
  desaparezca; solo se pierde el vínculo con la caja.
- **`turnos_caja.bodegaId`/`turnos_caja.cajeroId`/`turnos_caja.cerradoPorId`**
  son `ON DELETE CASCADE` hacia `bodegas`/`users` — mismo patrón de ramas
  hermanas que compiten al borrar un tenant completo (ver el punto
  anterior sobre `recibos_nomina`/`lineas_asiento`). `cerradoPorId` es
  nullable (solo se llena al cerrar) y usa la relación nombrada
  `"TurnoCajaCerradoPor"` porque `User` ya tiene la relación por defecto
  hacia `TurnoCaja` vía `cajeroId`.
- **`bodegas.sucursalId`** (Fase 8a, requerido) es `ON DELETE CASCADE`
  hacia `sucursales` — a diferencia de los casos de arriba, esto NO es
  una carrera de ramas hermanas: `Tenant → Sucursal → Bodega` es una
  cadena normal de padre-hijo, borrar la sucursal se lleva sus bodegas
  (y en cascada, su stock/facturas/etc., igual que borrar un tenant
  completo hoy). Backfill de datos existentes hecho a mano en la
  migración (`20260821090000_sucursales`, mismo patrón 3 pasos que
  `20260819080000_categorias`): columna nullable → `INSERT` de una
  "Sucursal Principal" por tenant con ≥1 bodega + `UPDATE` de esas
  bodegas → `ALTER COLUMN ... SET NOT NULL`.
- **`usuario_sucursales`** (Fase 8b, `@@id([userId, sucursalId])`) es
  copia exacta del patrón `user_roles` — pivote sin `tenantId` propio,
  ambos lados `ON DELETE CASCADE`. Sin ninguna fila para un usuario =
  ve/puede elegir todas las sucursales del tenant (default permisivo,
  ver ARCHITECTURE.md — Fase 9 es la que convierte esto en un límite
  real de acceso).
- **`cuentas_bancarias.cuentaContableId`, `gastos_menores.cuentaBancariaId`
  y `lineas_gasto_menor.cuentaContableId`** son `ON DELETE CASCADE` por el
  mismo patrón de ramas hermanas: `Tenant -> CuentaContable` y
  `Tenant -> CuentaBancaria -> GastoMenor -> LineaGastoMenor` compiten al
  borrar un tenant completo. Encontrado (otra vez) corriendo los e2e —
  ver los puntos anteriores sobre `linea_oc`/`recibos_nomina` para el
  mismo patrón ya documentado varias veces en este archivo.
- **`gastos_menores.ncf`/`tipoNcf`** reutilizan el mismo mecanismo de
  `ncf_asignados` que facturación (tipo `B11` tradicional o `E43` si el
  tenant está en modalidad e-CF) — no es una secuencia propia.
- **`pagos.retencionIsr`/`retencionItbis`** (default 0): retención de
  ISR/ITBIS practicada a un proveedor al pagarle una orden de compra
  (Art. 309/349), ingresada a mano por quien registra el pago — nunca se
  usa en pagos de `Factura`. `monto` sigue siendo el bruto que salda
  `orden_compra.total`; la retención solo cambia cuánto sale de Caja y a
  qué cuentas se acredita (ver ARCHITECTURE.md, "Retenciones a
  proveedores").
- **`asientos_contables.anulado`** no filtra ningún cálculo financiero
  (`lineasHasta`/`lineasEnRango`/`lineasEnRangoTodas`/`lineasPorCuenta`
  no excluyen asientos anulados) — es puramente informativo. El asiento
  reverso que genera `AsientosContablesService.anular` (origen
  `ANULACION`) cancela al original matemáticamente porque AMBOS siguen
  contando; filtrarlo excluiría la mitad de la cancelación y el reverso
  terminaría restando dos veces (bug real encontrado escribiendo el e2e
  de esta feature).
- **`lineas_asiento.conciliado`/`conciliadoEn`** (default false/null):
  conciliación bancaria manual (ver ARCHITECTURE.md) — cualquier línea
  puede marcarse, en la práctica solo se usa para las que tocan la
  cuenta contable vinculada a una `CuentaBancaria`.

## Migraciones

```bash
pnpm --filter ./backend prisma:migrate       # dev, genera migración + aplica
pnpm --filter ./backend prisma:migrate:deploy # CI/producción
pnpm --filter ./backend prisma:seed           # tenant demo + roles + admin
pnpm --filter ./backend db:rls                # aplica policies de RLS (correr después de cada migrate)
pnpm --filter ./backend prisma:studio         # explorador visual
```

## Agregar un modelo nuevo (o de un plugin)

1. Agrégalo a `schema.prisma` con `tenantId String` si es una tabla raíz
   de negocio (no una tabla hija).
2. Si lleva `tenantId`, agrégalo también a `TENANT_SCOPED_MODELS`
   (`backend/src/prisma/tenant-scoped-models.ts`) y a la lista de tablas
   en `prisma/sql/enable-rls.sql`.
3. `pnpm --filter ./backend prisma:migrate` y luego `db:rls`.
