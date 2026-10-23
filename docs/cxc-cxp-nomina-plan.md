# Plan: CxC, CxP y Nómina — hacia un nivel transaccional tipo Softland ERP

Análisis hecho el 2026-10-22, a pedido del usuario, comparando el estado real
del código contra tres especificaciones "ideales" de módulo (CxC, CxP,
RRHH/Nómina) que el usuario pegó, y contra el benchmark de Softland ERP
(referencia de la industria, con operación en RD). **Solo diagnóstico — nada
de esto se implementó todavía.** Sirve de punto de partida para retomar la
conversación de diseño más adelante.

## 🐛 Bugs reales encontrados (no son features faltantes — esto hoy está mal)

1. **CxP**: las devoluciones a proveedor (`DevolucionCompra`) no bajan el
   saldo pendiente que muestra el Aging Report de
   `CuentasPorPagarService.listar()/resumen()` — el cálculo las ignora.
2. **CxC**: `CuentasPorCobrarRepository` filtra `tipoFactura: 'CREDITO'` y
   **excluye NOTA_CREDITO/NOTA_DEBITO** del Aging Report/listado de CxC. Pero
   `ClientesService.estadoCuenta` sí las incluye y las neta. Resultado: el
   saldo del Aging puede no coincidir con el saldo real del Estado de Cuenta
   del mismo cliente.

Misma familia de bug en los dos lados del ciclo (ventas y compras): "el
agregado no refleja documentos tipo ajuste".

## Cuentas por Cobrar (CxC)

### Ya existe, nivel real
- Partidas abiertas pago↔factura — `Pago.facturaId` FK por fila, abonos
  parciales reconstruibles completos (`pagos.service.ts`).
- Asiento contable automático en el momento del cobro (no solo al facturar)
  — `ContabilidadEventosService` escucha `PAGO_FACTURA_REGISTRADO`.
- Recordatorios automáticos de facturas vencidas — cron diario
  (`RecordatoriosService`), Email/WhatsApp, plantilla `factura_vencida`.
- Aging Report con buckets (CORRIENTE/D1-30/D31-60/D61-90/D90+).
- Estado de cuenta de cliente (envío por Email/WhatsApp).
- Notas de Crédito/Débito, comisiones de vendedores (módulo propio).

### Parcial / básico
- Trazabilidad de cuenta corriente: es "saldo por factura", no un libro
  cronológico movimiento-por-movimiento (factura/abono/NC) con saldo
  corrido después de cada uno.
- Drill-down del Aging: ya lista cada factura individual, falta el link al
  documento completo.
- `Cliente.limiteCredito`/`plazoPagoDias`/categoría ya existen en el
  schema, pero `limiteCredito` nunca se valida en ningún guard al facturar
  (decisión consciente de dejarlo fuera en una sesión anterior).

### No existe
- Multi-moneda real en CxC — el campo de moneda en `Factura` es
  "puramente de presentación" (comentario explícito en el código); nunca
  afecta el monto real cobrado ni genera diferencial cambiario.
- Bloqueo automático por mora o límite de crédito excedido al facturar.
- Workflow de cobranza: estados (en gestión/promesa de pago/escalado),
  scoring de cliente, monto comprometido en una promesa de pago. La
  plomería de `ActividadCrm` ya admite `clienteId` directo y tipo
  `LLAMADA`, pero sin estos campos.
- Vendedor/cobrador asignado de forma persistente al cliente (solo existe
  `vendedorId` por transacción, no en `Cliente`).
- Provisión/castigo de cuentas incobrables.
- Proyección de ingresos / flujo de caja.
- Catálogo de "Tipos de Términos de Pago" nombrados (solo hay
  `plazoPagoDias` suelto + enum CONTADO/CREDITO).

### Ranking de brechas (si se quisiera profundizar)
1. **(Bug)** Incluir NOTA_CREDITO/NOTA_DEBITO en el Aging/listado de CxC.
2. Bloqueo automático por mora/límite de crédito al facturar.
3. Workflow de cobranza + campo de promesa de pago sobre `ActividadCrm`.
4. Cuenta corriente cronológica con saldo corrido.
5. Provisión/castigo de incobrables.

## Cuentas por Pagar (CxP)

### Ya existe, nivel real
- Partidas abiertas por proveedor — igual de sólido que en CxC.
- Asiento contable por pago, repartiendo automáticamente líneas de
  retención ISR/ITBIS cuando aplica — es el backbone contable más
  sofisticado de los tres módulos analizados.
- Aging Report con buckets (mismo mecanismo que CxC).
- Pagos parciales con tolerancia `EPSILON`.

### Parcial / básico
- Retenciones de ISR/ITBIS: el cálculo y el asiento son reales, pero la
  tasa se tipea a mano en cada pago (`CrearPagoOrdenCompraDto`, comentario
  explícito "ingresada a mano") — no hay catálogo de reglas por tipo de
  proveedor/concepto.
- Anticipo a proveedor: se puede pagar antes de que la orden esté
  `RECIBIDA`, pero siempre atado a una orden ya creada — no existe un
  anticipo suelto aplicable después contra órdenes futuras.
- Conciliación bancaria: existe (`EstadosFinancierosService`) pero es
  manual, genérica (no específica de proveedores) y sin importar
  extractos ni auto-match.
- `Proveedor` tiene `plazoPagoDias` pero no límite de crédito en RD$ ni
  cuenta contable asociada.

### No existe
- Autorización de pagos por nivel/monto (cualquiera con el permiso
  `compras.pagar` paga cualquier monto).
- Proyección/programación prospectiva de pagos (el Aging es 100%
  retrospectivo).
- Pagos en lote / archivo bancario.
- Multi-moneda — ni siquiera como presentación (a diferencia de `Factura`).
- Estado de Cuenta de Proveedor (existe el de Cliente, falta el espejo).
- Gastos operativos (`GastoMenor`: alquiler, servicios) nunca generan un
  pasivo con vencimiento — es pago inmediato sin `proveedorId`, queda
  fuera del ciclo de CxP/Aging por completo.
- Número de factura del proveedor: **ya existe** en `RecepcionCompra`
  (`facturaProveedorNumero`, `montoFacturaProveedor`). Falta agregar ahí
  mismo: **NCF/e-CF del proveedor**, fecha de la factura del proveedor y
  fecha de vencimiento — esto alimentaría directo al reporte 606 de DGII.

### Ranking de brechas
1. **(Bug)** Devoluciones no bajan el saldo del Aging.
2. Retenciones por catálogo/regla en vez de campo manual (insumo también
   para el 607).
3. Proyección prospectiva de pagos / flujo de caja.
4. Pagos en lote / archivo bancario.
5. NCF/e-CF + fecha de factura del proveedor en `RecepcionCompra` (gap
   chico y concreto, pedido explícito del usuario).

## Nómina / RRHH

### Ya existe, nivel real (más robusto de lo que documenta CLAUDE.md)
- Asistencia con cálculo automático de tardanza/horas extra.
- Horarios/turnos configurables (`HorarioEmpleado`/`PlantillaHorario`).
- Vacaciones/permisos con flujo de aprobación y cálculo legal por
  antigüedad (`vacaciones.util.ts`).
- Ausencias conectadas correctamente al cálculo: una vacación con goce
  (`conGoceDeSueldo:true`) no descuenta, una ausencia sin goce sí —
  filtro explícito y bien diseñado (`ausencias.repository.ts`).
- Catálogo de Puestos (`model Puesto`).
- Cierre de nómina dispara asiento contable automático (`marcarPagado`).
- Tasas TSS/SFS/AFP/INFOTEP configurables por tenant (`Configuracion`,
  con fallback a defaults) — la tabla de tramos de ISR es la única
  deliberadamente fija en código (decisión documentada en
  `calculo-nomina.ts`, ver ARCHITECTURE.md).

### Parcial / básico
- Reporte de aportes TSS/IR-3: calcula montos reales, pero no es el
  layout oficial exacto (mismo disclaimer que 606/607/608).
- Histórico de pagos por empleado: los recibos son consultables por
  período, falta una vista consolidada por empleado a través de varios
  períodos.

### No existe (gaps estructurales, no solo features sueltas)
- **Motor de "conceptos" genérico y configurable** — hoy los campos del
  recibo (SFS, AFP, ISR, horas extra, otras deducciones) son columnas
  fijas del modelo, no un catálogo de conceptos con fórmula editable por
  el tenant.
- **Pre-nómina editable** — `generarPeriodo` calcula y persiste de una
  sola pasada; el estado BORRADOR existe pero es inmutable, no hay
  ventana de revisión/ajuste línea por línea antes de procesar.
- **Multi-tipo de nómina por empleado — defecto latente real, no solo
  ausencia de feature.** `Empleado` no tiene ningún campo
  `tipoNomina`/`tipoPeriodoNomina`; `generarPeriodo` trae TODOS los
  empleados activos sin filtrar y les aplica el mismo `factorPeriodo`
  derivado del tipo del período. Si un tenant tuviera empleados
  quincenales y mensuales a la vez, hoy el sistema los prorratearía mal
  a todos por igual.
- Préstamos/anticipos a empleados (sin modelo, sin cuotas automáticas).
- Liquidaciones laborales (cesantía, preaviso, desahucio) — cero soporte.
- Provisión contable acumulada de vacaciones/cesantía como pasivo mes a
  mes (ni siquiera existe el cálculo puntual al salir el empleado).
- Volante/recibo de pago en PDF.
- Comisiones de venta → nómina: el módulo de comisiones existe y calcula
  solo, pero cero punto de integración con `generarPeriodo` (ni un TODO).
- Interfaz bancaria de dispersión de pago (`Empleado` no tiene ni campo
  de cuenta bancaria).
- Evaluación de desempeño / amonestaciones.
- Departamentos como catálogo propio (hoy `Empleado.departamento` es
  texto libre).

### Ranking de brechas
1. **Multi-tipo de nómina por empleado** — es el hallazgo más serio: no
   depende de pedir una feature nueva, ya está latente esperando a que
   un tenant use el sistema con dos periodicidades a la vez.
2. Motor de conceptos configurable + pre-nómina editable (misma pieza
   arquitectónica: sin catálogo de conceptos no hay nada que editar línea
   por línea).
3. Provisión contable acumulada de vacaciones/cesantía.
4. Préstamos/anticipos a empleados.
5. Liquidaciones laborales (cesantía/preaviso).

## Lectura general

**CxP tiene el backbone contable más maduro** de los tres (partidas
abiertas + asientos automáticos con retenciones repartidas). **CxC** tiene
buena base transaccional pero le falta la capa de "gestión de cartera"
(scoring, workflow de cobranza) que es justo donde Softland se diferencia.
**Nómina** tiene la brecha estructural más profunda: motor de cálculo
rígido (sin catálogo de conceptos) y el defecto de multi-tipo de nómina es
el hallazgo más urgente de los tres módulos.

## Próximos pasos sugeridos (sin decidir todavía)

1. Corregir los dos bugs de consistencia (CxC y CxP) — son correcciones,
   no decisiones de producto, bajo riesgo.
2. Agregar NCF/e-CF + fecha de factura del proveedor a `RecepcionCompra`
   — gap chico y ya pedido explícitamente.
3. Decidir con el usuario cuál de las piezas grandes priorizar primero:
   motor de conceptos de nómina + multi-tipo, workflow de cobranza en
   CxC, o retenciones por catálogo + proyección de flujo de caja en CxP.
