# Plan de trabajo — diseño y seguimiento

Documento vivo para llevar las planificaciones en curso del proyecto y
marcar qué se fue completando. No reemplaza `ARCHITECTURE.md`/
`GUIA_PLUGINS.md` (esos documentan lo ya construido y el porqué) — este
archivo es al revés: lo que todavía no se construyó, o se está diseñando,
y el estado real de cada frente abierto.

Convención de estado: `🔲 Pendiente de diseño` · `🟡 En diseño` ·
`🟢 Diseño listo, falta implementar` · `✅ Implementado y commiteado`.

## Resumen

| Tema | Estado |
|---|---|
| Período Contable — Fases 1+2 (aviso de período faltante + completar períodos) | ✅ Implementado — commits `88ea628`/`8eae640` |
| "Ver Stock" en Productos | ✅ Implementado — commit `dbccd79` |
| Asistente de pre-cierre contable | ✅ Implementado 2026-11-23 — ver detalle abajo |
| Período de trabajo + advertencia blanda | ✅ Implementado 2026-11-23 — ver detalle abajo |
| Parametrización de cuentas contables y centros de costo — los 4 puntos (banco real en Pagos; cuenta de ingreso/costo por categoría; Centro de Costo por línea; override de los 15 códigos fijos) | ✅ Implementado 2026-11-23 — plan completo |
| Depósito bancario (Caja → Banco) | ✅ Implementado 2026-11-23 — ver detalle abajo |
| Bug "removeChild" intermitente — 2 casos pendientes | ✅ Corregidos 2026-11-23 (`ProductoFormulario`, `FacturacionNueva`) — ver detalle abajo |
| Backlog UX/operación (Conteo Físico, modales→página, parámetros operativos, reporte de problemas, manual) | ✅ Ya estaba completo — los 5 bloques tienen commit (ver detalle abajo), `memoized-noodling-moore.md` estaba desactualizado |

---

## 1. Asistente de pre-cierre contable

**Estado:** ✅ Implementado 2026-11-23.

Contexto: hasta ahora `CierrePeriodoService.cerrarPeriodo()` era
puramente mecánico — no exigía ninguna conciliación/arqueo antes de
permitir el cierre, el operador tenía que cuadrar todo por su cuenta
fuera del sistema.

**Investigación previa al diseño** (cambió el alcance del borrador
original): se verificó contra el código real qué documentos pueden de
verdad amenazar la exactitud de los libros de un período ya cerrado.
`Factura.estado` nunca llega a `BORRADOR` en la práctica (ningún código
lo setea — estado vestigial del enum), y Compras/Gastos Menores nunca
quedan "a medias" con una fecha retroactiva pendiente. Por eso el
checklist final tiene **dos secciones con semántica distinta**, a
propósito separadas:

- **Riesgos contables** (si se ignoran, queda un cabo suelto real sobre
  la exactitud del efectivo del período): conciliación bancaria
  pendiente por cuenta (reusa `EstadosFinancierosService.
  conciliacionBancaria`, solo cuentas con saldo pendiente ≠ 0) + turnos
  de POS `ABIERTO`/`PENDIENTE_REVISION` con `abiertoEn` dentro del rango
  — esto último es un control de efectivo, no genera ni depende de
  ningún asiento (cerrar un turno no postea nada).
- **Pendientes comerciales** (recordatorio de proceso de ventas, NUNCA
  un riesgo contable — rotulado y coloreado distinto a propósito):
  Cotizaciones `BORRADOR`/`ENVIADA` sin `facturaId`, y Remisiones
  `ENTREGADA` sin `facturaId` (el caso real: "se entregó, nunca se
  cobró") dentro del rango. Ninguna de las dos generó jamás un asiento
  ni puede reabrir retroactivamente el período al resolverse después
  (usan la fecha del momento en que se conviertan, no la original).

**Nunca bloquea** (decisión confirmada, mismo criterio que
`excedioSaldo` de Depósito Bancario): `GET /contabilidad/cierre-periodo/
:id/asistente-precierre` (permiso `contabilidad.cerrarperiodo`, sin
migración — solo lecturas) se consulta dentro de un `ConfirmModal` que
reemplaza el "Cerrar" directo en `CierrePeriodoView.tsx` — el checklist
se muestra, y el botón real sigue siendo "Cerrar de todas formas".

Verificado en vivo contra datos reales del tenant demo: el período de
noviembre mostró correctamente la conciliación pendiente de Banreservas
(-RD$16,933.58, dato real ya existente) y una cotización sin convertir
(00003, creada dentro del rango) — ambos números confirmados contra la
base de datos. 2346 unitarios + 260 e2e en verde, `tsc --noEmit` limpio
en ambos paquetes.

## 2. Período de trabajo + advertencia blanda

**Estado:** ✅ Implementado 2026-11-23.

Contexto: inspirado en un ERP de referencia que usa el usuario — un
"período de trabajo" (una fecha, no necesariamente un mes entero) que:

- Precarga esa fecha por defecto en los formularios nuevos, en vez de "hoy".
- Avisa (sin bloquear) si se elige una fecha de un mes distinto al del
  período de trabajo activo.

Convive con la validación dura existente (`validarPeriodoAbierto`), no la
reemplaza — esa sigue siendo el único control real de "¿se puede postear
acá?".

**100% frontend, sin backend ni migración** — investigación previa: casi
ningún módulo admite fecha manual (Facturación/POS/Compras/Nómina
siempre usan "ahora"); los únicos 5 formularios con un campo de fecha
editable son Asiento Contable, Gasto Rápido, Gasto Menor, Factura de
Proveedor y Depósito Bancario (los 3 modales de pago NO tienen campo de
fecha en absoluto, se descartaron de este alcance).

`PeriodoTrabajoContext` (`frontend/src/contexts/PeriodoTrabajoContext.tsx`)
— mismo patrón exacto que `SucursalActivaContext` (localStorage, por
navegador/usuario, **no** tenant-wide): si fuera una sola fecha para todo
el tenant, alguien haciendo catch-up de un mes viejo le rompería el
default a cualquier otro cargando algo de hoy en simultáneo. Widget
nuevo en el header (`PeriodoTrabajoWidget`, al lado de Bandeja de
WhatsApp) para ver/cambiar la fecha, con "Volver a hoy". Componente
`AvisoFechaPeriodoTrabajo` (comparación simple de `YYYY-MM`, sin líos de
zona horaria) conectado en los 5 formularios — advertencia inline, nunca
bloquea.

Verificado en vivo: cambiar el período de trabajo a otro mes precarga
esa fecha en Asiento Contable Nuevo tras recargar la página (persiste en
localStorage); elegir una fecha de un tercer mes distinto muestra el
aviso; volver al mismo mes lo oculta; "Volver a hoy" resetea
correctamente. `tsc --noEmit` limpio en ambos paquetes (sin tests de
frontend en este proyecto — no hay ningún archivo `*.test.*`/`*.spec.*`
en `frontend/src` todavía).

## 3. Parametrización de cuentas contables y centros de costo

**Estado:** 🟡 En diseño — diagnóstico completo (2026-11-23), diseño
preliminar abajo, pendiente de confirmar con el usuario antes de
implementar nada.

### Diagnóstico

Hoy conviven dos mecanismos:

- **Código fijo** (`CODIGOS_CUENTA` en `cuentas-base.ts`, 15 cuentas):
  resuelve Facturación/Compras/Nómina/Pagos/Incobrables/Cierre de Período.
  Mismo string para todos los tenants, sin override posible, sin endpoint
  de edición de cuentas existentes.
- **Cuenta elegida a mano por línea**: Gasto Menor, Factura de Proveedor,
  Asiento manual, Gasto Rápido — el usuario elige la cuenta cada vez, sin
  ningún default ni "categoría de gasto" que la recuerde.
- **Única parametrización real que existe hoy**:
  `CuentaBancaria.cuentaContableId` — pero solo lo usa Gastos Menores.
  **Pagos y Nómina lo ignoran** y siempre asientan contra la cuenta fija
  `1010 Caja y Bancos`, sin importar el banco real elegido.
- Productos/Categorías no tienen cuenta de ingreso/costo propia — toda
  venta cae siempre en 4010/5010, sin segmentar por línea de negocio.
- No existe el concepto de "centro de costo" en ningún lado del sistema.

### Huecos a resolver, de menor a mayor esfuerzo

1. ✅ **Conectar `CuentaBancaria.cuentaContableId` en Pagos** (Cobro de
   factura, Pago de orden de compra, Pago de factura de proveedor) —
   implementado y verificado 2026-11-23. Campo nuevo `cuentaBancariaId`
   (opcional) en `ReciboIngreso`/`OrdenPago` — migración
   `20261123145406_conectar_cuenta_bancaria_a_pagos`. Si no se elige
   banco, sigue cayendo en la cuenta genérica fija de siempre
   (retrocompatible). El selector de banco solo aparece si la forma de
   pago no es efectivo (decisión 2026-11-23: el efectivo primero entra a
   Caja, no a un banco — el "depósito" Caja→Banco con su propio asiento
   queda pendiente de diseño, ver nota abajo). De paso se corrigió un bug
   real preexistente: pagar una Factura de Proveedor directa (sin orden
   de compra) no generaba NINGÚN asiento contable (evento sin listener).
   **Nómina queda fuera** — se pospuso a la sesión de rediseño completo
   de Nómina/RRHH (decisión 2026-11-23), sigue usando la cuenta genérica.
2. ✅ **Cuenta de ingreso/costo por Categoría de producto** —
   implementado y verificado 2026-11-23. `cuentaIngresoId`/`cuentaCostoId`
   opcionales en `Categoria` (migración
   `20261123153327_categoria_cuenta_ingreso_costo`), configurables desde
   el panel de Categorías. `AsientosContablesService.generarDesdeFactura`
   ahora agrupa el ingreso/costo de cada línea por la cuenta de su
   categoría (`ContabilidadEventosService.agruparVentaPorCuenta`), en vez
   de una sola línea agregada — sin override, cae en la genérica de
   siempre (retrocompatible). Recargos y líneas manuales siempre van a la
   genérica (sin categoría que atribuirles). Verificado end-to-end vía
   API: una venta de un producto con cuenta de ingreso propia contabilizó
   en esa cuenta, no en la 4010 genérica.

   **Bug real encontrado y corregido de paso** (`CategoriasPanel.tsx`):
   variante nueva del "removeChild intermitente" (ver ARCHITECTURE.md) —
   no hacía falta un toggle `editando`, bastaba con que el texto del
   botón de submit cambiara ("Crear categoría" ↔ "Guardando…"), porque
   `Button` infiere un ícono distinto según el texto. Fix: `icon={null}`
   en ese botón. **Se encontraron 2 casos más del mismo bug, sin
   corregir** (fuera de alcance de este punto): crear un producto nuevo
   (navegación post-creación) y seleccionar un cliente en Facturación
   Nueva — candidatos a una ronda de auditoría propia.
3. ✅ **Centro de Costo — catálogo nuevo, transversal** —
   implementado y verificado 2026-11-23. Modelo `CentroCosto` (tenantId,
   nombre, activo — catálogo plano sin jerarquía, mismo patrón CRUD que
   `FormaPago`: listado sin permiso restrictivo, crear/editar con
   `admin.configuracion`), página propia en Finanzas y Contabilidad →
   Catálogos. `centroCostoId` opcional **por línea** (decisión confirmada
   2026-11-23: más trabajo de UI que la cabecera, pero permite dividir un
   mismo documento entre varios centros) en `LineaAsiento` (manual y
   todos los generados), `LineaGastoMenor`, `FacturaProveedorLinea`,
   `LineaFactura` (ventas — hereda en Nota de Crédito/Débito, igual
   criterio que unidadMedidaId) y `LineaOc`/`LineaRecepcion` (Compras —
   heredado de LineaOc a LineaRecepcion al recibir, igual criterio que
   factorConversion).

   **Decisión confirmada**: Centro de Costo y Proyecto son **dos
   dimensiones independientes que se pueden combinar** en el mismo
   gasto/asiento — no se fusionan en un solo catálogo. Centro de Costo
   (sucursal/departamento/área) vive en el núcleo, disponible para
   cualquier tenant tenga o no el plugin Proyectos activo.

   Motor de asientos: `AsientosContablesService.generarDesdeFactura` ahora
   agrupa por la combinación cuenta+centro de costo (no solo cuenta, ver
   punto 2) vía el helper `agruparPorCuentaYCentroCosto`, reusado también
   por `generarDesdeCompra` para segmentar el débito a Inventario por
   centro de costo entre las líneas de una recepción. Gasto Menor/Factura
   de Proveedor/Asiento manual ya posteaban línea a línea, solo se
   propaga el campo. **Límite de alcance conocido**: la devolución a
   proveedor (`generarReversaCompra`/`LineaDevolucionCompra`) sigue
   revirtiendo en bloque, sin segmentar por centro de costo — no se tocó.

   Reporte: filtro por un Centro de Costo puntual (o "todos") en el
   Estado de Resultados existente (`GET /contabilidad/estado-resultados
   ?centroCostoId=`) — decisión confirmada de no construir un comparativo
   nuevo por columnas en esta ronda.

   **Bug real encontrado y corregido de paso**: el filtro devolvía 400
   ("property centroCostoId should not exist") — el `ValidationPipe`
   global rechaza cualquier query param no declarado en el DTO usado por
   `@Query()`, y `centroCostoId` se había agregado como un
   `@Query('centroCostoId')` suelto en vez de en el DTO. Fix:
   `EstadoResultadosQueryDto extends ReporteFiscalQueryDto` con el campo
   agregado ahí (mismo patrón que `ReporteFiscalExportarQueryDto`).

4. **Override de los 15 códigos fijos (`CODIGOS_CUENTA`) por tenant** — ✅
   implementado 2026-11-23. Modelo nuevo `ConfiguracionCuentaContable`
   (tenantId + clave, único, FK a `CuentaContable` con `onDelete:
   Cascade`) — migración `20261123182037_configuracion_cuenta_contable`.

   Mecanismo: `CuentasContablesRepository.resolverRolDeCuenta(tenantId,
   clave, codigoFijo)` reemplaza, en **los 27 puntos del motor** donde
   antes se llamaba `buscarPorCodigoGlobal(tenantId, CODIGOS_CUENTA.X)`
   (`AsientosContablesService` completo + el único uso en
   `CierrePeriodoService`), buscando primero un override configurado y
   cayendo al código fijo de siempre si no hay ninguno — refactor
   mecánico vía `sed`, con un solo caso manual (el ternario
   CONTADO/CAJA_BANCOS vs. CUENTAS_POR_COBRAR en `generarDesdeFactura`).

   Validación al configurar un override
   (`CuentasContablesService.configurarCuentaSistema`): la `clave` tiene
   que ser un rol real de `CODIGOS_CUENTA`, la cuenta elegida tiene que
   pertenecer al tenant (404 vía `buscarPorId`), estar `activa`, y ser
   del mismo `tipo` contable que la cuenta fija que reemplaza (nuevo
   `TIPO_ESPERADO_POR_ROL` en `cuentas-base.ts`, derivado de
   `CUENTAS_BASE` en vez de hardcodeado aparte) — así no se puede, por
   ejemplo, apuntar "Caja y Bancos" (ACTIVO) a una cuenta de GASTO.
   `listarConfiguracionCuentasSistema` siempre devuelve los 15 roles
   (con `cuentaConfigurada: null` si no hay override), para que la UI
   pinte una fila fija por rol.

   Página nueva `/contabilidad/cuentas/configuracion-sistema`
   (`ConfiguracionCuentasSistema.tsx`, aparte de Catálogo de Cuentas,
   mismo criterio que "Formas de pago"): tabla de 15 filas (rol/código
   fijo/selector de cuenta filtrado por el tipo esperado), autoguardado
   al cambiar el selector (`POST` si elige cuenta, `DELETE` si lo deja en
   blanco).

   **Bug real encontrado y corregido de paso**: el filtro de Estado de
   Resultados por centro de costo (punto 3) devolvía 400 ("property
   centroCostoId should not exist") — mismo patrón de bug que el de la
   nota de abajo, por un `@Query('centroCostoId')` suelto en vez de en
   el DTO; se corrigió junto con este punto creando
   `EstadoResultadosQueryDto extends ReporteFiscalQueryDto`.

   Verificado en el sistema real (no solo con mocks): configurar
   CAJA_BANCOS → cuenta 1050 vía la UI, confirmar en BD que la factura
   CONTADO generada después asienta contra 1050 y no contra 1010, quitar
   el override y confirmar que vuelve a 1010; más los 3 rechazos
   (`clave` inválida, cuenta inactiva, tipo incorrecto) probados por
   `curl` directo. 2331 unitarios + 259 e2e en verde, `tsc --noEmit`
   limpio en ambos paquetes.

### Nota de BD

Los puntos 2 y 3 requieren migración de Prisma (campos/modelo nuevo) —
avisar explícitamente antes de aplicarla, como ya es regla en este
proyecto.

### Depósito bancario (Caja → Banco)

**Estado:** ✅ Implementado 2026-11-23. Surgió al decidir cómo tratar el
efectivo en el punto 1 de parametrización de cuentas: el efectivo cobrado
no entra directo a una cuenta bancaria, primero queda en Caja (billetes
en mano) y solo se vuelve "banco" cuando alguien deposita — hasta ahora
no existía ningún camino para modelar ese movimiento.

Modelo nuevo `DepositoBancario` (numero correlativo propio
`DEPOSITO_BANCARIO`, cuentaBancariaId destino, monto, numeroComprobante y
bodegaId opcionales — este último **solo informativo**, de qué sucursal
salió el efectivo, decisión confirmada de no desglosar el asiento por
sucursal porque hoy TODO el efectivo cae en una sola cuenta contable
tenant-wide) — migración `20261123193726_deposito_bancario`.

Al crear: genera **Débito [cuenta contable del banco elegido] / Crédito
Caja y Bancos** por el monto, vía evento (`DEPOSITO_BANCARIO_CREADO` →
`ContabilidadEventosService.alCrearDeposito` → nuevo
`AsientosContablesService.generarDesdeDeposito` — mismo criterio
desacoplado que el resto de módulos de negocio, nunca llama a
Asientos directo). Calcula el saldo actual de Caja y Bancos
(`EstadosFinancierosService.libroMayor`) y guarda `excedioSaldo`/
`saldoDisponibleAlMomento` como una bandera **fija** (no se recalcula
sola después) — decisión confirmada: solo advierte, nunca bloquea.

**Editar** (decisión confirmada, se desvía del patrón "sin edición, se
anula y se recrea" que usa el resto de documentos contables, a pedido
explícito del usuario para poder corregir un depósito marcado en rojo):
por dentro reversa el asiento con los valores viejos (negados) y postea
uno nuevo con los valores corregidos — mismo mecanismo que
`generarReversaCompra`/`generarDesdeFacturaProveedor` (nunca edita/borra
un asiento ya posteado), invisible para el usuario, que solo ve "Editar"
como una sola acción. El saldo "sin el depósito viejo" se calcula
sumando de vuelta su monto al saldo actual (era un crédito a Caja) —
matemática síncrona, no depende de que el listener async ya haya
corrido. **Anular** sigue el mismo patrón de reversa, una sola vez, y
deja el depósito en estado `ANULADO` (no editable después).

Página propia (`/depositos-bancarios`, lista con fila roja si
`excedioSaldo`, "Nuevo depósito" página + "Ver/Editar/Anular" en una
sola página con toggle `editando`, mismo criterio que `OrdenCompraVer`),
menú bajo Finanzas y Contabilidad → Transacciones.

**Bug real encontrado de paso (no relacionado con este punto)**: al
diseñar esto se notó que `CentroCosto`/`ConfiguracionCuentaContable`
(punto 3/4 de parametrización de cuentas, 2026-11-23) habían quedado
afuera de `TENANT_SCOPED_MODELS`/`enable-rls.sql` — `CentroCosto` era un
bug de aislamiento ACTIVO de verdad (`CentrosCostoRepository.listar()`/
`buscarPorId()` no filtraban tenantId por su cuenta, dependían 100% de
esa inyección automática que nunca se activó). Corregido agregando
ambos modelos a las 2 listas + aplicando RLS (`pnpm run db:rls`) +
sumando un caso de aislamiento e2e nuevo para Centro de Costo (regla ya
establecida del proyecto).

Verificado en el sistema real: crear un depósito con un banco cuya
cuenta contable coincidía por datos de prueba con la propia "Caja y
Bancos" (asiento degenerado pero balanceado, no es un bug, es la data de
prueba), editarlo a una cuenta bancaria distinta (confirmado en BD: el
asiento 33 original se reversa en el 34, el 35 postea correctamente
Débito banco nuevo/Crédito Caja con cuentas DISTINTAS), anularlo
(asiento 36 reversa el 35), y confirmar que ni "editar" ni "anular" se
pueden repetir sobre uno ya anulado (400 en ambos casos). UI confirmada:
banner rojo de saldo excedido solo mientras `ABIERTO`, desaparece al
anular; botones Editar/Anular desaparecen al anular. 2343 unitarios +
260 e2e en verde, `tsc --noEmit` limpio en ambos paquetes. Todos los
datos de prueba (depósito, asientos, cuenta bancaria de prueba) limpiados
de la BD al terminar.

**Nota de despliegue**: el nuevo tipo de correlativo `DEPOSITO_BANCARIO`
no necesita backfill — `CorrelativosRepository.siguienteEnTx` crea la
fila con defaults sola la primera vez que se usa, para cualquier tenant
(ya existente o nuevo). Sí hace falta correr `pnpm run db:rls` en
producción tras el deploy (ya se corrió acá en dev) para que las 3 tablas
nuevas (`depositos_bancarios`, `centros_costo`,
`configuraciones_cuenta_contable`) queden con RLS real.

### Bug "removeChild" intermitente — 2 casos encontrados en la auditoría del punto 2, corregidos

**Estado:** ✅ Corregido 2026-11-23.

Los 2 casos quedaron documentados como pendientes al cerrar el punto 2 de
parametrización de cuentas. Al retomarlos, el diagnóstico original
("ícono inferido cambia de texto") no aplicaba a ninguno de los dos —
ambos son variantes del mismo patrón general (un swap de subárbol DOM en
el mismo tick/macrotask que otro) pero con un disparador distinto cada
uno:

1. **`ProductoFormulario.tsx` (crear producto)**: el `onSuccess` de
   `guardar` llamaba `queryClient.invalidateQueries(...)` de forma
   síncrona, en el mismo tick en que `guardar.isPending` pasa a `false`
   — y ese mismo cambio de `id` (al navegar a `/productos/:id`) monta
   `VariantesProductoPanel` donde antes había solo un párrafo. Fix:
   diferir las 2 invalidaciones + el `navigate` dentro del mismo
   `setTimeout(…, 0)` que ya usaba el `navigate`.
2. **`FacturacionNueva.tsx` (elegir cliente)**: un `useEffect` sobre
   `cliente?.id` llamaba `setInfoColapsada(true)` de forma síncrona,
   colapsando `CardColapsable` (que retorna un `<button>` en vez de la
   `<section>` completa — swap de subárbol real, no solo CSS) en el
   mismo tick en que `ComboboxBusqueda`/el modal "Explorar toda la
   lista" todavía estaban desmontando su propio listado al cerrarse tras
   la selección. Fix: diferir `setInfoColapsada(true)` en un
   `setTimeout(…, 0)` dentro del mismo efecto.

**No se pudo forzar el crash de nuevo** en varios intentos en vivo
(instrumentando `Node.prototype.removeChild` para capturar el error) ni
antes ni después del fix — consistente con ser intermitente de verdad.
El fix aplicado es el mismo patrón ya probado y confirmado en
`CategoriasPanel`/`CentrosCostoPanel` (diferir cualquier
invalidación/cambio de estado que pueda disparar un swap de subárbol a
un macrotask separado), así que se aplicó preventivamente sin depender
de reproducirlo a voluntad. `tsc --noEmit` limpio; QA en vivo confirmó
que ambos flujos (crear producto, elegir cliente) siguen funcionando
igual que antes.

---

## Backlog UX/operación (heredado de sesión de plan mode)

**Estado:** ✅ Completo — al retomarlo 2026-11-23 se confirmó que los 5
bloques del plan guardado en
`C:\Users\longb\.claude\plans\memoized-noodling-moore.md` ya tenían
commit (ese archivo de plan mode había quedado desactualizado, nunca se
tachó al cerrarlo):

- [x] Bloque 1 — Conteo Físico a página, selector real — commit `fc678f1`
      (`InventarioConteoNuevo.tsx`, filtra `controlaVencimiento` del lado
      del frontend, bodega siempre primero, mensajes de error TOTAL vs.
      SELECCION distintos en `ConteoFisicoService.crear`).
- [x] Bloque 2 — Modales → páginas completas (Factura/Cotización/Remisión
      "Ver detalle", Gestión de Cobro, Gasto Menor) — mismo commit
      `fc678f1`.
- [x] Bloque 3 — Parámetros Generales operativos (`STOCK_MINIMO_DEFAULT`,
      `PLAZO_PAGO_DIAS` conectados; `ITBIS_REDUCIDA`/retenciones marcadas
      "solo referencia") — commit `e6e8ff0`.
- [x] Bloque 4 — Sistema de reporte de problemas (tenant → plataforma) —
      commits `4244ec6`/`9044d6f`/`281486e`/`dcdbb58` (modelo
      `ReporteTenant`, permiso `platform.soporte.gestionar`).
- [x] Bloque 5 — Manual de Finanzas y Contabilidad (documento, Claude
      Docs) — publicado ("Manual de Finanzas y Contabilidad" /
      "Manual de Contabilidad" en la galería de artifacts).

No queda nada abierto de este backlog.
