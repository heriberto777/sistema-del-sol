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
| Asistente de pre-cierre contable | 🔲 Pendiente de diseño |
| Período de trabajo + advertencia blanda | 🔲 Pendiente de diseño |
| Parametrización de cuentas contables y centros de costo — los 4 puntos (banco real en Pagos; cuenta de ingreso/costo por categoría; Centro de Costo por línea; override de los 15 códigos fijos) | ✅ Implementado 2026-11-23 — plan completo |
| Depósito bancario (Caja → Banco) | 🔲 Pendiente de diseño |
| Bug "removeChild" por ícono inferido del `<Button>` (variante nueva) | 🔲 2 casos encontrados sin corregir (ProductoNuevo, FacturacionNueva) — ver ARCHITECTURE.md |
| Backlog UX/operación (Conteo Físico, modales→página, parámetros operativos, reporte de problemas, manual) | 🔲 Pendiente — ver detalle en `memoized-noodling-moore.md` (plan de Claude Code) |

---

## 1. Asistente de pre-cierre contable

**Estado:** 🔲 Pendiente de diseño (acordado dejarlo para otra sesión, 2026-11-23).

Contexto: hoy `CierrePeriodoService.cerrarPeriodo()` es puramente mecánico
— no exige ninguna conciliación/arqueo antes de permitir el cierre, el
operador tiene que cuadrar todo por su cuenta fuera del sistema. La sesión
de diseño pendiente debe cubrir, como mínimo:

- Checklist de conciliación bancaria pendiente del rango (módulo Bancos).
- Turnos de caja/arqueos de POS sin cerrar dentro del rango.
- Documentos en borrador (facturas/compras/gastos) con fecha dentro del
  período que se quiere cerrar.
- Si el checklist **bloquea** el cierre o solo **advierte**.

## 2. Período de trabajo + advertencia blanda

**Estado:** 🔲 Pendiente de diseño (acordado dejarlo para otra sesión, 2026-11-23).

Contexto: inspirado en un ERP de referencia que usa el usuario — un
"período de trabajo" configurado (ej. noviembre 2026) que:

- Precarga esa fecha por defecto en los formularios nuevos, en vez de "hoy".
- Avisa (sin bloquear) si se elige una fecha fuera de un rango "con
  advertencia" configurado.

Convive con la validación dura existente (`validarPeriodoAbierto`), no la
reemplaza — esa sigue siendo el único control real de "¿se puede postear
acá?".

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

### Pendiente nuevo — Depósito bancario (Caja → Banco)

**Estado:** 🔲 Pendiente de diseño (surgió 2026-11-23, al decidir cómo
tratar el efectivo en el punto 1).

El efectivo cobrado no entra directo a una cuenta bancaria — primero
queda en Caja (billetes en mano), y solo se vuelve "banco" cuando alguien
deposita. Falta modelar ese movimiento Caja → Banco como su propio
proceso, con asiento contable real (débito Banco, crédito Caja) validado
contra un recibo/comprobante de depósito — hoy ese efectivo simplemente
se queda contabilizado en la cuenta genérica `1010 Caja y Bancos` sin
ningún camino para moverlo a una cuenta bancaria puntual.

---

## Backlog UX/operación (heredado de sesión de plan mode)

Ver detalle completo en el plan de Claude Code guardado en
`C:\Users\longb\.claude\plans\memoized-noodling-moore.md`. Resumen:

- [ ] Bloque 1 — Conteo Físico a página, selector real
- [ ] Bloque 2 — Modales → páginas completas (Factura/Cotización/Remisión
      "Ver detalle", Gestión de Cobro, Gasto Menor)
- [ ] Bloque 3 — Parámetros Generales operativos (`STOCK_MINIMO_DEFAULT`,
      `PLAZO_PAGO_DIAS`)
- [ ] Bloque 4 — Sistema de reporte de problemas (tenant → plataforma)
- [ ] Bloque 5 — Manual de Finanzas y Contabilidad (documento, Claude Docs)
