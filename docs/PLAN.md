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
| Parametrización de cuentas contables y centros de costo — punto 1 (banco real en Pagos) | ✅ Implementado 2026-11-23 — resto (2, 3, 4) sigue 🟡 en diseño |
| Depósito bancario (Caja → Banco) | 🔲 Pendiente de diseño |
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
2. **Cuenta de ingreso/costo por Categoría de producto** — agregar
   `cuentaIngresoId`/`cuentaCostoId` opcionales en `Categoria`, con
   fallback a 4010/5010 si no están seteados (retrocompatible, ningún
   tenant existente se rompe).
3. **Centro de Costo — catálogo nuevo, transversal** — modelo
   `CentroCosto` (tenantId, código, nombre, activo), parametrizable desde
   Catálogo de Cuentas o una pantalla hermana. Campo opcional
   `centroCostoId` en `LineaAsiento`/`LineaGastoMenor`/
   `FacturaProveedorLinea` (y quizás a nivel de cabecera de
   Factura/Compra). Reporte nuevo: P&L por centro de costo.

   **Decisión confirmada (2026-11-23)**: Centro de Costo y Proyecto son
   **dos dimensiones independientes que se pueden combinar** en el mismo
   gasto/asiento — no se fusionan en un solo catálogo. Centro de Costo
   (sucursal/departamento/área) vive en el núcleo, disponible para
   cualquier tenant tenga o no el plugin Proyectos activo; Proyecto sigue
   respondiendo "¿para qué proyecto puntual es esto?" (rentabilidad de
   una obra/consultoría concreta). Un gasto podría llevar ambos a la vez
   (ej. Proyecto "Casa López" + Centro de Costo "Sucursal Santiago").
   Implica dos campos opcionales independientes donde aplique
   (`centroCostoId` además de `proyectoId`), no un campo que sustituya al
   otro.

4. **Override de los 15 códigos fijos (`CODIGOS_CUENTA`) por tenant** — el
   más riesgoso: requiere poder editar/reasignar una `CuentaContable` sin
   romper el motor de asientos automáticos. Probablemente el último en
   hacerse, y solo si de verdad hace falta (hoy ningún tenant real lo
   pidió explícitamente, es un hueco teórico encontrado en el
   diagnóstico).

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
