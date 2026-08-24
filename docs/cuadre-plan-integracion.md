# Plan de integración: brechas de Cuadre → Sistema del Sol

Checklist de trabajo derivado de `docs/cuadre-auditoria.md` (investigación
completa, 5 pasadas) y del artefacto "Radar Cuadre" publicado en la
conversación. Marcá `[x]` a medida que se entrega cada ítem — cada uno tiene
un código corto (ej. `B-3`) para referenciarlo en el chat sin repetir el
título completo ("seguimos con B-3").

## Cómo usar este documento

- **No es un orden obligatorio** — a diferencia del roadmap original de 9
  fases (que sí era secuencial), esto es un catálogo priorizado de brechas
  independientes entre sí. Se ataca en el orden que el usuario prefiera.
- Cada ítem tiene una marca de tamaño: 🟥 **grande** (varios días, toca
  varios módulos o es un producto nuevo), 🟧 **medio** (1-2 sesiones,
  extiende un módulo existente), 🟨 **chico** (una sesión, campo/parámetro
  puntual), ✅ **ya cubierto** (no era una brecha real).
- Los ítems 🟥 llevan además una nota "**diseño primero**" — antes de
  escribir código hace falta una conversación de alcance (como se hizo con
  Sucursales/Fase 8 y PIN/Fase 9), no arrancar directo a implementar.
- Al final hay dos secciones aparte: "Ya vamos adelante" (no son brechas,
  no tocar) y el historial de correcciones (para no repetir la
  investigación).

## ⚠️ Segunda pasada de verificación (2026-08-21) — leer antes de tocar cualquier ítem

La comparación original se armó describiéndole a los forks de auditoría
"lo que ya tenemos" **de memoria**, a partir de CLAUDE.md, sin releer el
código real. Al empezar a implementar se encontraron **13 ítems** donde esa
descripción estaba parcial o totalmente equivocada — algunos ya estaban
100% construidos, otros a medio construir. Se hizo una segunda pasada
completa, grep/lectura directa contra el código actual, ítem por ítem, y
se corrigió todo el catálogo abajo. **Regla para lo que sigue**: antes de
empezar cualquier ítem que todavía diga 🟥/🟧/🟨, volver a confirmar contra
el código — esta segunda pasada fue exhaustiva pero el código sigue
cambiando.

Resumen de lo que cambió (detalle en cada ítem más abajo):
- **Ya estaba 100% construido** (no eran brechas): F-1, F-3, F-6, F-7,
  E-10, H-1.
- **Ya estaba parcialmente construido** (se redujo el alcance real): B-1,
  E-1, E-5, E-11, G-7.
- **Confirmado como brecha real, sin cambios**: todo lo demás.

---

## A — Motores de negocio nuevos

- [ ] **A-1** 🟥 *diseño primero* — **Comisiones de venta de punta a punta**:
  % de comisión por producto y por oferta, cálculo al facturar, 3 reportes
  (por venta/vendedor/producto). *Confirmado: no existe ningún campo de
  comisión en `schema.prisma` — brecha real, sin cambios.*
- [ ] **A-2** 🟥 *diseño primero* — **Motor de Ofertas ampliado**: agregar
  tipos BOGO ("Compra X Lleva Y", "Segunda Unidad"), tope de descuento
  máximo, control de acumulabilidad, prioridad entre ofertas simultáneas.
  Extiende `OfertasService`/`model Oferta` existente (Fase 4b), no es un
  módulo nuevo desde cero. *Confirmado: `Oferta` solo tiene
  `TipoDescuentoOferta` (Porcentual/Fijo), sin `descuentoMaximo`,
  `acumulable`, `prioridad` ni `pagaComision` — brecha real. Matiz: sí
  usamos `DateTime` para `fechaInicio`/`fechaFin`, así que "vigencia con
  hora exacta" no necesita cambio de esquema, solo que el formulario deje
  elegir hora además de fecha.*
- [ ] **A-3** 🟥 *diseño primero* — **Lealtad / puntos / recompensas**:
  acumulación (por monto o unidad), canje, expiración opcional. Apple/Google
  Wallet queda fuera de un primer corte. *Confirmado: cero mención de
  "lealtad"/"puntos" en todo el schema — brecha real, sin cambios.*
- [ ] **A-4** 🟥 *diseño primero, alcance grande* — **Tienda online**:
  subdominio propio por tenant + Site Builder + pedidos + checkout. Producto
  nuevo completo — merece su propia conversación de alcance separada.
  *Sin verificar (obviamente no construido, no hace falta confirmar).*

## B — Fiscal y DGII

- [x] **B-1** 🟨 — **NCF/e-CF seleccionable de verdad al facturar**. El
  hallazgo real detrás de este ítem no era el enum (eso era cosmético) —
  era que `FacturacionService.crear()` derivaba el `TipoNcf` siempre
  automático desde `tipoFactura`, así que B14/B15 (que ya estaban en el
  enum) nunca los podía producir ningún flujo real. Entregado: `CrearFacturaDto`
  gana `tipoComprobanteEspecial?: 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL'`
  (solo válido con CONTADO/CREDITO, se ignora en NC/ND) que sustituye el
  NCF automático por B14/B15 o sus nuevos equivalentes e-CF `E44`/`E45`;
  selector "Tipo de comprobante" agregado al formulario de Facturación
  (default "Normal", sin fricción para el caso común); `NcfPanel` ya
  también deja crear secuencia para `B11`/`E43`/`E44`/`E45` (antes el
  backend los soportaba pero el dropdown no los mostraba). **Deliberadamente
  fuera de alcance**: `B13`/`B16`/`B17`/`E41`/`E46`/`E47` — ninguno tiene
  un proceso de negocio real del otro lado (exportaciones, pagos al
  exterior) que los produciría; agregarlos al enum sin nada que los use
  sería una brecha decorativa. Migración
  `20260821130000_tipo_ncf_especial`. Entregado 2026-08-21.
- [x] **B-2** 🟧 — **Secuencias de NCF por sucursal** (hoy `NcfAsignado` es
  `@@unique([tenantId, tipoNcf])`, sin sucursal) + **umbral de alerta**
  configurable ("quedan pocos comprobantes"). *Confirmado: brecha real —
  el módulo `ncf/` existe pero no tenía ninguno de los dos.* Entregado:
  `NcfAsignado.sucursalId` (nullable = compartida, default) +
  `umbralAlerta` (nullable = sin alerta). `siguienteNcfEnTx` intenta la
  secuencia de la sucursal de la bodega de la venta primero y cae a la
  compartida si no existe — cero cambio de comportamiento para un tenant
  sin secuencias por sucursal. Emite `EVENTOS.NCF_POR_AGOTARSE` (mismo
  patrón que `stock_bajo`, solo a Admin Total) cuando los restantes caen
  al umbral. `PATCH /admin/ncf/:id` (antes `:tipoNcf` — ya puede haber
  varias filas por tipo). Migración `20260826100000_ncf_sucursal_umbral`.
  Entregado 2026-08-24.
- [x] **B-3** 🟨 — **Leyes Fiscales**: % del ITBIS a pagar por norma/sector
  (ej. construcción). Decisión del usuario: se ata al **Producto** (no al
  Cliente ni a la Factura) — la reducción depende de QUÉ se vende.
  Catálogo `LeyFiscal` (código, nombre, % ITBIS a pagar, descripción) +
  `Producto.leyFiscalId`; ITBIS efectivo = `porcentajeItbis *
  (porcentajeItbisAPagar/100)` en `calcularLineasYTotales()`, evaluado
  después del toggle B-7 (`aplicaItbis: false` sigue ganando). Panel
  propio en Admin → Catálogo → "Leyes fiscales". Migración
  `20260824140000_leyes_fiscales`. Entregado 2026-08-24.
- [ ] **B-4** 🟨→🟧 *(corrección de tamaño)* — **Recargos de Factura**:
  cargos post-subtotal (Imprevistos, Viáticos, etc.), con "% gravado con
  ITBIS" opcional y orden configurable. *Confirmado: brecha real, pero
  más grande de lo catalogado: necesita un catálogo (`RecargoFactura`)
  MÁS una tabla hija nueva para los recargos aplicados a cada factura
  (`FacturaRecargo`, patrón `FacturaPlataformaLinea`) MÁS cambios en
  `calcularLineasYTotales()` MÁS actualizar impresión/PDF para mostrarlos
  — no es un campo suelto como B-7/B-8, es una entidad nueva. Candidato a
  su propia sesión (no bloqueante, pero no se apuró para no arriesgar un
  bug de cálculo fiscal sin poder correr tests en esta tanda).*
- [ ] **B-5** 🟥 *diseño primero* — **e-CF real (firma y envío a la DGII)**:
  Cuadre integra un proveedor certificado ("Pascal ECF") en vez de construir
  el firmador propio. *Confirmado: brecha real, ya documentada en
  ARCHITECTURE.md ("e-NCF propio... la firma/envío quedan fuera de esta
  fase a propósito").*
- [x] **B-6** 🟧→🟨 *(alcance reducido — falso positivo)* — **Condición de
  pago con plazo explícito** (15/30/45/60/90 días) con vencimiento
  auto-calculado. *Corrección: `Factura.plazoPagoDias` YA existía
  (`@default(30)`) y `RecordatoriosService` YA lo usaba para detectar
  facturas vencidas — el gap real era que `CrearFacturaDto` no lo
  exponía, ninguna factura podía elegir otro plazo que no fuera el
  default silencioso.* Entregado: `CrearFacturaDto.plazoPagoDias?`
  (15/30/45/60/90) se propaga a `crearFacturaEnTx`; selector +
  "Vencimiento" auto-calculado (cliente, sin columna nueva) en
  `ModalNuevaFactura`, visible solo con `tipoFactura: CREDITO`. Sin
  migración. Entregado 2026-08-24.
- [x] **B-7** 🟨 — **Toggle de ITBIS por línea** de factura.
  `LineaFacturaDto.aplicaItbis` (default `true`) fuerza 0% en la línea
  sin tocar `producto.porcentajeItbis` — para una venta puntual exenta.
  Sin migración (no toca schema). Entregado 2026-08-24.
- [x] **B-8** 🟨 — **Descuento general de documento** (% o $) sobre el
  subtotal completo. `CrearFacturaDto.descuentoGeneralPct`/
  `descuentoGeneralMonto` (excluyentes, 400 si ambos), reutiliza
  `prorratearDescuentoCarrito()` — se acumula con Ofertas automáticas y
  descuentos por línea, no aplica a NOTA_CREDITO/NOTA_DEBITO. UI en
  `ModalNuevaFactura`; el POS no necesitó cambios (F-1/`ModalDescuento`
  "seleccionar todos" ya logra el mismo efecto). Sin migración. Entregado
  2026-08-24.
- [ ] **B-9** 🟨→🟥 *(corrección de tamaño — ver nota)* — **Línea manual/
  libre en factura**, no ligada a un producto del catálogo. *Confirmado:
  `LineaFacturaDto.productoId` sigue siendo `@IsUUID()` obligatorio —
  brecha real, pero MÁS GRANDE de lo catalogado: `LineaFactura.productoId`/
  `varianteId` son columnas `NOT NULL` con FK `RESTRICT` en el schema, un
  invariante documentado a propósito en ARCHITECTURE.md/CLAUDE.md
  ("perder a qué variante corresponde una línea ya emitida sería perder
  historial real"). Soportar una línea de verdad libre exige volverlas
  nullable — con impacto en impresión/PDF, reportes y exportador fiscal
  606/607/608 (todos asumen hoy que toda línea tiene producto/variante).
  **Decisión del usuario (2026-08-24): dejar pendiente** — evaluar bien
  cómo manejar el proceso de insertar líneas de producto sin que exista
  un producto real, antes de decidir el diseño. No retomar sin volver a
  traer el tema.*

## C — Pagos

- [ ] **C-1** 🟥 *diseño primero* — **AZUL y CARDNET** para las ventas del
  propio tenant (link de pago + terminal física Pin Pad). *Confirmado:
  brecha real — existe un patrón de adaptador reutilizable
  (`PasarelaPagoAdapter`, con `AzulAdapter`/`CardNetAdapter` ya como stubs),
  pero es para la **facturación de la plataforma a los tenants**
  (`facturacion-plataforma/pasarela/`), un contexto totalmente distinto a
  que un cliente le pague a un tenant en su POS. El patrón de adaptador es
  reusable como referencia de diseño, pero no hay nada construido para
  este caso.*
- [ ] **C-2** 🟧 — **Multi-moneda de punta a punta**. *Confirmado: brecha
  real en comportamiento — existe un campo `TenantSettings.moneda` (String,
  default "DOP") pero no se lee/usa en ningún lado del backend; es un
  campo muerto, no una feature.*

## D — Autorización de acciones sensibles

- [ ] **D-1** 🟧 *diseño primero* — **Capa 2 de autorización (opcional) por
  un segundo usuario real** (email con código de un solo uso) para
  anulaciones/devoluciones grandes. *Confirmado: brecha real, sin
  cambios — nuestro PIN de Fase 9 sigue siendo 100% autoservicio.*

## E — Operación diaria / Inventario

- [ ] **E-1** 🟧 *(matiz importante)* — **Patrón Borrador → Confirmado** en
  Compras, Ajustes y Transferencias. *Parcialmente construido y NO
  utilizado: `EstadoOrdenCompra` YA tiene `BORRADOR`/`ENVIADA` en el enum
  (además de `RECIBIDA_PARCIAL`/`RECIBIDA_TOTAL`/`CANCELADA`), pero
  `ComprasService`/`ComprasRepository` nunca transicionan a `ENVIADA` ni
  ofrecen un endpoint de "editar borrador" o "confirmar" — una OC nueva
  queda huérfana en `BORRADOR` hasta que alguien la recibe directo. Son
  estados vestigiales sin flujo real detrás. Ajustes/Transferencias no
  tienen ningún campo de estado — ahí la brecha es completa. Alcance real:
  activar el flujo que ya sugiere el enum de Compras + agregarlo desde
  cero a Ajustes/Transferencias.*
- [x] **E-2** 🟨 — **Motivo de ajuste estructurado**: enum
  `MotivoAjusteInventario` (Merma / Robo-Pérdida / Daño / Vencimiento /
  Corrección de conteo / Otro), requerido en `AjustarStockDto`; el texto
  libre (`motivo`) pasó a opcional y ahora es solo detalle adicional — si
  se omite, se guarda la etiqueta legible del motivo elegido. Migración
  `20260821120000_motivos_estructurados`. Entregado 2026-08-21.
- [x] **E-3** 🟨 — **Kardex agregado "todas las bodegas"**: `bodegaId`
  pasó a opcional en `GET /inventario/kardex/:varianteId` — omitido,
  agrega el movimiento de todas las bodegas del tenant (cada fila trae
  su `bodega` para mostrarla). Sin bug de cálculo: el saldo corriente ya
  dependía del signo real de cada movimiento (`direccion`), no de a qué
  bodega pertenece, así que la agregación cruzada es correcta sin tocar
  esa lógica. `KardexView.tsx` gana un checkbox "Todas las bodegas" y
  una columna "Bodega" condicional. Entregado 2026-08-21.
- [x] **E-4** 🟧 — **Alertas de inventario segmentadas**: 4 categorías (Sin
  Stock / Stock Bajo / Por Vencer 7 días / Vencidos) con dashboard propio.
  *Confirmado: brecha real — el reporte hoy era un solo contador
  (`stockBajoConteo`), mezclando "sin stock" y "stock bajo pero > 0", sin
  nada sobre vencimientos.* Entregado: `GET /reportes/dashboard` gana
  `alertasInventario: {sinStock, stockBajo, porVencer7Dias, vencidos}`
  (aditivo, `productosStockBajo` intacto) — umbral fijo de 7 días para
  vencimientos, independiente del umbral de 30 días del cron de avisos
  existente. Segunda fila de tarjetas en `Dashboard.tsx`, filtrable por
  sucursal igual que el resto. Sin migración. Entregado 2026-08-24.
- [x] **E-5** 🟧 *(alcance reducido)* — **Cliente: campos que faltan**.
  *YA tenemos `limiteCredito` (Decimal) y `esConsumidorFinal` (que ES el
  "cliente por defecto"/walk-in de Cuadre) en `model Cliente`.* Entregado:
  catálogo `CategoriaCliente` (plano, informativo, panel propio en
  Admin → Catálogo → "Categorías de cliente") y `Cliente.
  comprobantePorDefecto` (4 valores, autoselecciona tipoFactura +
  tipoComprobanteEspecial al elegir el cliente en `ModalNuevaFactura`).
  Nota: la autoselección se implementó solo en Facturación, no en POS —
  el POS todavía no tiene ningún selector de tipoFactura/NCF (ver F-2,
  brecha separada); cuando F-2 se implemente, debería reusar el mismo
  campo. Migración `20260821170000_cliente_categoria_comprobante`.
  Entregado 2026-08-21.
- [ ] **E-6** 🟧 — **Cierres de caja como dashboard**: desglose de ventas
  por TODAS las formas de pago (no solo efectivo), estado "Pendiente
  revisión". *Confirmado: brecha real — `EstadoTurnoCaja` solo tiene
  `ABIERTO`/`CERRADO`.*
- [ ] **E-7** 🟥 *diseño primero* — **"Caja" como entidad propia**
  (restricción de catálogo por terminal). *Confirmado: brecha real, no
  existe ningún modelo `Caja` — es literalmente `Bodega`+`TurnoCaja`.*
- [ ] **E-8** 🟧 *(matiz)* — **Producto: campos avanzados** — precio
  variable, presentación de compra con conversión bulto→unidad, "es
  ingrediente", "permite devolución" por producto, códigos alternos
  múltiples. *Confirmado en su mayoría real, con un matiz: `unidadMedida`
  YA existe como `String @default("UND")` libre — no es un enum
  estructurado kg/g/lb/etc. con conversión, pero tampoco es un campo
  ausente; alcanza con ampliarlo si se necesita una lista cerrada. El resto
  (comisión — ver A-1, OTP, precio variable, ingrediente, permite
  devolución, códigos alternos) sigue ausente.*
- [x] **E-9** 🟨 — **Color por categoría "para POS"**: `Categoria.color`
  nuevo, enum nullable `ColorCategoria` (12 valores, puramente
  decorativo). Selector en `CategoriasPanel.tsx` (form + swatch en la
  tabla) y punto de color en cada píldora de categoría del filtro de
  `CatalogoProductosPos.tsx`, para escaneo visual rápido en el POS.
  Migración `20260821150000_categoria_color`. Sin cambios de repositorio
  (`crear`/`actualizar` ya hacían spread `...dto`). Entregado 2026-08-21.
- [x] **E-10** ✅ *ya cubierto, no era una brecha real* — **Bonos en
  lote**: `EmitirLoteBonosDto` (`backend/src/bonos/dto/`) YA permite
  generar hasta 500 de una vez (tope de seguridad, no de negocio — subible
  si hace falta), con `fechaVencimiento` YA obligatoria en `model Bono`.
  Lo único que falta de la comparación original: el tipo "uso único" (hoy
  todo bono es multi-uso tipo gift card, decrementa `saldoActual`) y la
  asociación opcional a un cliente específico — ninguno de los dos
  justifica un ítem propio, se pueden agregar como parte de cualquier
  trabajo futuro sobre Bonos si se necesitan.
- [x] **E-11** 🟨 *(alcance reducido, corrección adicional)* — **Formas de
  pago: lo que falta**. *YA tenemos `requiereReferencia` (Boolean) en
  `model FormaPago`. **Corrección**: "Crédito Cliente" también estaba
  mal — ya existe como fila sembrada en `FORMAS_PAGO_BASE` desde antes de
  este ítem (nombre únicamente, sin comportamiento de cuenta corriente
  detrás, otro falso positivo del catálogo original).* Entregado:
  `FormaPago.tipo` (enum `TipoFormaPago`, 7 categorías), nullable,
  puramente informativo — `esEfectivo`/`esBono` siguen siendo los que
  gatillan comportamiento real. Backfill por nombre exacto solo para las
  7 filas de fábrica. Deliberadamente fuera de alcance: hacer que "Crédito
  Cliente" descuente de verdad contra `Cliente.limiteCredito` — es una
  funcionalidad de cuentas por cobrar más grande, candidata a su propia
  sesión de diseño. Migración `20260821160000_forma_pago_tipo`. Entregado
  2026-08-21.

## F — POS

- [x] **F-1** ✅ *ya cubierto, no era una brecha real* — **Modal de descuento
  dedicado**: `ModalDescuento` en `TurnoCajaDetalle.tsx` ya tiene % o monto
  fijo, checkbox por línea del carrito + "seleccionar todos".
- [x] **F-2** 🟨 — **Tipo de NCF integrado al selector de cliente**, con
  botón "Nuevo cliente" inline sin salir de la venta. *Confirmado: brecha
  real — no había ninguna selección de `tipoFactura` en el flujo del
  POS (`registrarVenta` forzaba `CONTADO` siempre).* Entregado:
  `RegistrarVentaPosDto` gana `tipoFactura?`/`tipoComprobanteEspecial?`
  (mismo vocabulario que Facturación, ítem B-1), default `CONTADO` si se
  omite; selector "Tipo"/"Comprobante" junto al combobox de cliente en
  `TurnoCajaDetalle.tsx`, con autoselección desde `Cliente.
  comprobantePorDefecto` (ítem E-5) igual que en Facturación; botón
  "+ Nuevo cliente" inline (`NuevoClienteInlinePos`) sin salir de la
  venta. Entregado 2026-08-24.
- [x] **F-3** ✅ *ya cubierto, no era una brecha real* — **Panel "Facturas de
  la sesión"**: la sección "Ventas del turno" en `TurnoCajaDetalle.tsx` ya
  lista todo lo vendido en el turno actual, inline, con imprimir/anular por
  fila.
- [x] **F-4** 🟧 — **Canales de entrega del recibo**: email y WhatsApp
  además de imprimir. *Confirmado: brecha real — el envío automático
  existente (`alFacturarse`, dispara en cada factura si el Cliente ya
  tiene email/teléfono guardado) NO cubre el caso real de POS con
  "Consumidor Final", que no tiene datos de contacto propios.* Entregado:
  `POST /facturas/:id/enviar-recibo` (`{ canal, destinatario }`,
  `destinatario` se escribe en el momento, no depende del Cliente),
  clave de plantilla propia `factura_recibo`. Sección "Enviar recibo" en
  `ModalImprimir.tsx` (compartido con Facturación/POS), visible solo
  para facturas. Sin adjuntar PDF (limitación deliberada, ver
  ARCHITECTURE.md). Sin migración. Entregado 2026-08-24.
- [x] **F-5** 🟨 — **Movimiento de caja con motivo estructurado**: enum
  `MotivoMovimientoCaja` (Fondo de cambio / Depósito / Corrección / Otro),
  requerido en `CrearMovimientoCajaDto`; `concepto` (texto libre) pasó a
  opcional. Entregado 2026-08-21.
- [x] **F-6** ✅ *ya cubierto, no era una brecha real* — **Confirmación al
  retomar un carrito guardado**: `ModalGuardadas` ya tiene un botón
  "Recuperar" explícito por fila.
- [x] **F-7** ✅ *ya cubierto, no era una brecha real* — **Cobertura de
  `useAtajosTeclado`**: `TurnoCajaDetalle.tsx` YA tiene F2/F3/F4/F5/F6/F7/
  F8/F9/F10/F12/⇧F12 wireados — el mismo set de 12 acciones que Cuadre
  (el único "faltante", F11 para facturas de la sesión, no hace falta:
  ver F-3, ya está siempre visible sin atajo).
- [x] **F-8** 🟨 — **PWA instalable**: manifest + service worker básico.
  `frontend/public/manifest.webmanifest` + `sw.js` (sin caché a
  propósito — el proyecto no tiene modo offline, cachear rompería esa
  garantía) + íconos SVG con la paleta `sol` (placeholder hasta que el
  tenant tenga un logo real). Registrado en `main.tsx`, enlazado en
  `index.html`. Sin cambios de backend. Entregado 2026-08-24.
- [ ] **F-9** 🟥 *diseño primero* — **Impresión local ESC/POS + apertura de
  gaveta**: agente descargable. *Confirmado: brecha real, ya documentada en
  ARCHITECTURE.md.*

## G — RRHH

- [x] **G-1** 🟧 — **Horarios como plantilla reutilizable**. *Confirmado:
  `HorarioEmpleado` sigue siendo una fila por `empleadoId` sin concepto de
  plantilla — brecha real.* **Diseño confirmado con el usuario
  (2026-08-24, `AskUserQuestion`): referencia viva** — un empleado apunta
  a una `PlantillaHorario`, editar la plantilla se propaga a TODOS los
  empleados asignados (no una copia que se independiza al aplicarse).
  Entregado: módulo `plantillas-horario/` (catálogo + días, `PUT .../
  dias`), `Empleado.plantillaHorarioId` (auto-asigna la `predeterminada`
  del tenant si no viene explícita al crear), `PlantillasHorarioRepository.
  resolverDiasEfectivos()` como único punto que `AsistenciaService`
  (G-4) consulta para tardanza/horas extra — gana sobre `HorarioEmpleado`
  individual cuando hay plantilla asignada. Frontend: pestaña "Plantillas
  de horario" (RRHH) con editor de días; `HorarioEmpleadoPanel` oculta el
  editor individual y avisa cuando el empleado usa una plantilla.
  Migración `20260825100000_plantillas_horario`. Entregado 2026-08-24.
- [x] **G-2** 🟧→🟨 *(alcance reducido a propósito)* — **Tipos de
  Ausencia configurables por tenant**. *Confirmado: `TipoAusencia`
  sigue siendo un enum fijo de Prisma — brecha real, pero reemplazarlo
  por un catálogo libre (como hace Cuadre) fue deliberadamente
  descartado: en RD los tipos de ausencia son categorías fijas del
  Código de Trabajo y VACACIONES es legalmente especial (balance por
  antigüedad ya calculado), así que "inventar tipos nuevos" no es una
  necesidad real — lo configurable es la REGLA de cada tipo.*
  Entregado: catálogo `TipoAusenciaConfig` (`@@unique([tenantId,
  tipo])`, 6 filas fijas sembradas al provisionar + backfill por
  migración) con `maximoDiasPorAnio` (nullable, ignorado para
  VACACIONES), `conGoceDeSueldoPorDefecto`, `requiereAprobacion`,
  `activo`. `AusenciasService.crear()` rechaza tipos desactivados,
  valida el tope de días/año (no VACACIONES, que sigue su balance
  legal) y auto-aprueba cuando `requiereAprobacion: false`. Panel
  "Tipos de ausencia" en RRHH (editar las 6 filas, sin crear/eliminar).
  Migración `20260826090000_tipos_ausencia_config`. Entregado
  2026-08-24.
- [x] **G-3** 🟨 — **Aprobación de registros de asistencia**. Flujo
  `PENDIENTE → APROBADO/RECHAZADO` en `RegistroAsistencia` (`estado`/
  `aprobadoPorId`/`fechaResolucion`), calcado de `Ausencia.estado` —
  puramente de revisión/auditoría, ningún cálculo de nómina lo lee.
  `PATCH /nomina/asistencia/:id/estado` (`rrhh.aprobar`). Migración
  `20260824100000_asistencia_aprobacion`. Entregado 2026-08-24.
- [x] **G-4** 🟨 — **Umbral de horas extra + tolerancia de salida
  anticipada** configurables. `Configuracion.ASISTENCIA_UMBRAL_HORAS_EXTRA`
  (default 8h/día) y `ASISTENCIA_TOLERANCIA_SALIDA_ANTICIPADA_MIN`
  (default 15 min), calculados una sola vez al marcar la salida
  (`RegistroAsistencia.salidaAnticipada`/`horasExtra`), mismo criterio
  que `tardanza`. Migración `20260824110000_asistencia_horas_extra`.
  Entregado 2026-08-24.
- [x] **G-5** 🟨 — **Calendario de feriados**. Modelo `Feriado` (catálogo
  plano tenant-scoped: nombre, fecha, recurrenteAnual, activo), módulo y
  panel propios (RRHH → Feriados). Deliberadamente sin efecto automático
  en tardanza/horas extra/nómina todavía — es solo el catálogo.
  Migración `20260824120000_feriados`. Entregado 2026-08-24.
- [x] **G-6** 🟧→🟨 *(alcance reducido)* — **Deducciones de nómina
  configurables** (AFP/SFS) — **mantener el ISR calculado en código**
  (`isr.util.ts`). *Confirmado: no existía ningún modelo de deducciones
  configurables — brecha real.* Entregado: en vez de un modelo nuevo, se
  reusó el store genérico `Configuracion` (mismo patrón que
  `ASISTENCIA_UMBRAL_HORAS_EXTRA`) — 7 claves nuevas
  (`NOMINA_TASA_SFS_EMPLEADO/EMPLEADOR`, `NOMINA_TASA_AFP_EMPLEADO/
  EMPLEADOR`, `NOMINA_TASA_INFOTEP_EMPLEADOR`, `NOMINA_TOPE_SFS`,
  `NOMINA_TOPE_AFP`), leídas por `PeriodosNominaService.generarPeriodo()`
  y pasadas a `calcularRecibo()` (que ahora las recibe como parámetro en
  vez de importar las constantes directo). Sin panel propio — aparecen
  solas en Admin → Parámetros. **ISR intacto, sin cambios** — sigue
  siendo la ventaja competitiva documentada frente a Cuadre. Sin
  migración (no toca schema). Entregado 2026-08-24.
- [x] **G-7** 🟨 *(alcance reducido)* — **Nómina: lo que falta de
  período/puesto**. `TipoPeriodoNomina` ganó `SEMANAL` y `BIMENSUAL`
  (`FACTOR_PERIODO_NOMINA` en `nomina-config.ts`): `SEMANAL` = 7 días
  del divisor legal 23.83 (no un genérico mes/4); `BIMENSUAL` = mismo
  factor 0.5 que `QUINCENAL` (RAE: "dos veces al mes", no "cada dos
  meses"). Migración `20260821140000_periodo_nomina_semanal_bimensual`.
  Entregado 2026-08-21. El filtrado por Puesto queda cubierto por G-8
  (catálogo `Puesto` + filtro en `GET /nomina/empleados`, entregado
  2026-08-24) — filtrar la generación de NÓMINA en sí por puesto sigue
  sin implementarse, no hubo caso de uso concreto que lo pidiera.*
- [x] **G-8** 🟨 — **Catálogo de "Puestos"** estructurado. Modelo `Puesto`
  (catálogo plano), `Empleado.puestoId` (FK opcional, puramente aditivo —
  `Empleado.cargo` texto libre NO se tocó, sigue resolviendo "Vendedor"
  vía `contains` insensitive en `listarVendedores`). Filtro
  `GET /nomina/empleados?puestoId=` + panel propio (RRHH → Puestos).
  Migración `20260824130000_puestos`. Entregado 2026-08-24.
- [ ] **G-9** 🟥 *diseño primero, depende de hardware del cliente* —
  **Integración con relojes biométricos** (ANVIZ/CrossChex Cloud).
  *Confirmado: brecha real, sin cambios.*

## H — Comunicación y plantillas

- [x] **H-1** ✅ *ya cubierto en su mayoría, no era una brecha real* —
  **Editor de plantillas de notificación**: `backend/src/notificaciones/`
  YA tiene un sistema completo — `model NotificacionPlantilla`,
  `CrearPlantillaDto` (canal, clave, asunto, cuerpo con `{{variable}}`,
  activa), `plantilla-renderer.ts` (motor de sustitución de variables), y
  un panel de administración propio en el frontend
  (`PlantillasNotificacionPanel.tsx`, dentro de `Notificaciones.tsx`). Ya
  hay 5 eventos reales wireados: `factura_creada`, `cotizacion_enviada`,
  `stock_bajo`, `lote_por_vencer`, `factura_vencida` — muy cerca de los 5
  tipos de Cuadre. Lo único que le falta de la comparación original: no
  soporta condicionales tipo `{{#if}}` (solo sustitución simple de
  variables) y no hay plantilla para "Bienvenida"/"Código OTP" como claves
  propias (el reset de password usa su propio flujo, no este sistema). Si
  se necesita alguno de esos dos, es un ítem chico, no el rediseño
  completo que se había planteado.
- [ ] **H-2** 🟥 *diseño primero, alcance grande* — **WhatsApp
  conversacional con IA**: bot que responde automáticamente a clientes.
  *Confirmado: brecha real — nuestro canal de WhatsApp solo envía
  notificaciones salientes, sin recepción/respuesta automática.*
- [ ] **H-3** 🟧 — **Plantillas de documentos personalizables** (factura/
  recibo). *Confirmado: brecha real — `documento-pdf.ts`/`documento-ticket.ts`
  son generadores fijos en código, sin ningún editor.*

## I — Contabilidad

- [ ] **I-1** 🟥 *diseño primero* — **Cierre de período fiscal real**.
  *Confirmado: brecha real, ya documentada en ARCHITECTURE.md.*

## J — Varios / bajo esfuerzo

- [x] **J-1** 🟨 — **Impresora de etiquetas ZPL/EPL**.
  `generarZplEtiquetas()`/`generarEplEtiquetas()` (`etiquetas-codigo-
  barras.ts`) generan el texto de comandos y lo descargan (`.zpl`/
  `.epl`) — sin agente local, mismo criterio que la impresión térmica
  existente y que la exclusión de F-9. Botones "ZPL"/"EPL" junto a
  "Imprimir etiquetas" en `VariantesProductoPanel.tsx`. Sin cambios de
  backend. Entregado 2026-08-24.
- [x] **J-2** 🟨 — **Catálogo de reportes ampliado** (por vendedor, código
  alterno, rentabilidad). `GET /reportes/ventas/agrupado?dimension=` (6
  dimensiones: cliente/categoría/producto/vendedor/formaPago/código
  alterno) + `GET /reportes/ventas/rentabilidad` (margen bruto, costo
  VIGENTE hoy — no histórico, limitación documentada). 2 pestañas nuevas
  en Reportes → Ventas. Comisiones queda fuera (ver A-1). Sin exportador
  xlsx/pdf todavía. Sin migración. Entregado 2026-08-24.
- [x] **J-3** 🟨 — **"Mensaje a cajas"** (broadcast a terminales POS). En
  Redis (no Postgres, aviso efímero sin historial), TTL 8h.
  `POST`/`DELETE /pos/mensaje-cajas` (`pos.supervisar`), `GET` con
  `pos.ver`. Banner con polling cada 30s (`MensajeCajasBanner.tsx`) en
  `PosCaja.tsx`; panel para publicar/borrar en `Pos.tsx` (solo
  supervisores). Sin WebSockets — no hay esa infraestructura en el
  proyecto. Sin migración. Entregado 2026-08-24.
- [ ] **J-4** 🟨→🟥 *(corrección — diseño primero)* — **API keys con
  scopes granulares**. *Confirmado: el propio catálogo ya lo marcaba
  "no aplica hasta que exista una API pública propia" — verificado: no
  existe ninguna. Implementar autenticación por API key sin decidir
  primero SI/CÓMO se expone una API pública sería construir superficie
  de autenticación real (riesgo de seguridad) para una feature que
  nadie puede usar todavía — brecha decorativa en el mejor caso, hueco
  de seguridad mal diseñado en el peor. Reclasificado a "diseño
  primero", NO implementado — necesita decidir el alcance de una API
  pública antes de poder diseñar sus scopes.*

---

## Ya vamos adelante (no son brechas — no tocar pensando que hay que "ponerse al día")

- **RBAC granular por permiso** — Cuadre tiene 4 roles fijos (Propietario/
  Administrador/Gerente/Usuario) sin editor de permisos; nuestros roles
  personalizados a checkbox por módulo/acción son más flexibles.
- **Cálculo de ISR por tramos en código** — el modo "Escalonado" de
  deducciones de Cuadre admite en su propia UI que no es self-service.
- **Remisiones / notas de entrega** — no existe ningún equivalente en todo
  el menú de Cuadre.

---

## Historial de correcciones

- **2026-08-21**: entregados E-2 y F-5. Al empezar F-1 se descubrió que ya
  estaba construido, lo que disparó una segunda pasada de verificación
  completa contra el código (no solo contra este documento) — 13 ítems
  corregidos (6 ya construidos del todo, 5 parcialmente, quedaron con
  alcance reducido). Ver la sección "⚠️ Segunda pasada de verificación"
  arriba para el detalle completo.
- **2026-08-21**: entregado B-1 — resultó ser más que "agregar tipos al
  enum": el hallazgo real fue que ningún flujo dejaba elegir el tipo de
  NCF al facturar. Ver el ítem B-1 arriba para el detalle.
- **2026-08-21**: entregados E-3 (Kardex agregado "todas las bodegas"),
  G-7 (períodos `SEMANAL`/`BIMENSUAL` con factor legal correcto) y E-9
  (color decorativo por categoría, para escaneo visual en el POS). Los 3
  pasaron tsc + suite completa (715 unitarios + 179 e2e) + lint + build
  antes de este commit.
- **2026-08-21**: entregados E-5 (categoría/segmentación de cliente +
  comprobante fiscal por defecto) y E-11 (tipo estructurado de forma de
  pago). Otra corrección encontrada al implementar E-11: "Crédito
  Cliente" ya existía como fila sembrada — no era una brecha real, solo
  le faltaba la clasificación de tipo.
- **2026-08-24**: entregado F-2 (tipo de NCF en el selector de cliente
  del POS + botón "Nuevo cliente" inline) — reutiliza directo el
  vocabulario de B-1/E-5 (`tipoFactura`/`tipoComprobanteEspecial`,
  autoselección desde `Cliente.comprobantePorDefecto`). Confirmado antes
  de tocar código que `PosService.registrarVenta` forzaba `tipoFactura:
  'CONTADO'` sin ninguna forma de cambiarlo.
- **2026-08-24**: entregados los 4 ítems 🟨 de RRHH — **G-3** (aprobación
  de asistencia, `PENDIENTE→APROBADO/RECHAZADO`, sin efecto en nómina),
  **G-4** (umbral de horas extra + tolerancia de salida anticipada,
  configurables vía `Configuracion`), **G-5** (calendario de feriados,
  catálogo puro) y **G-8** (catálogo de Puestos, aditivo — `Empleado.cargo`
  no se tocó). Los 4 son independientes entre sí, implementados en la
  misma tanda.
- **2026-08-24**: entregados B-7 (toggle de ITBIS por línea) y B-8
  (descuento general de documento, % o $, prorrateado con
  `prorratearDescuentoCarrito()`) en `FacturacionService.
  calcularLineasYTotales()` — por tocar el cálculo fiscal compartido por
  Facturación/Cotizaciones/Remisiones/POS. **Corrección de
  tamaño encontrada al verificar B-3/B-4/B-9 antes de implementarlos**:
  los 3 resultaron más grandes de lo catalogado — se le preguntó al
  usuario cómo seguir con B-3/B-9 (`AskUserQuestion`). Decisión: **B-3
  se ata al Producto** (implementado, ver arriba) — **B-9 queda
  pendiente**, el usuario quiere evaluar bien el proceso de insertar
  líneas de producto sin un producto real antes de decidir el diseño, no
  retomar sin volver a traer el tema. B-4 (Recargos) se reclasificó a
  🟧 sin implementar (catálogo + tabla hija + cambios de impresión, más
  grande que un campo suelto) — no bloqueante, candidato a su propia
  sesión cuando se priorice.
- **2026-08-24**: entregado B-3 (Leyes Fiscales) — catálogo `LeyFiscal` +
  `Producto.leyFiscalId`, ITBIS efectivo = `porcentajeItbis *
  (porcentajeItbisAPagar/100)`, evaluado después del toggle B-7.
- **2026-08-24**: entregado B-6 — otro falso positivo encontrado al
  verificar antes de implementar: `Factura.plazoPagoDias` YA existía
  (`@default(30)`) y `RecordatoriosService` YA lo usaba para detectar
  vencidas; el gap real era que `CrearFacturaDto` no lo exponía. Alcance
  reducido de 🟧 a 🟨 — solo hizo falta un campo + selector, no un
  modelo nuevo.
- **2026-08-24**: verificación completa del lote acumulado (F-2, G-3,
  G-4, G-5, G-8, B-3, B-6, B-7, B-8 — 9 migraciones, 6 módulos backend
  nuevos, cambios en el núcleo de cálculo de Facturación y de
  Asistencia): `tsc --noEmit` limpio (back y front), **740 tests
  unitarios + 179 e2e, todos verdes** (1 falla de precisión de punto
  flotante en el test de B-3 corregida con `toBeCloseTo`, no era un bug
  real), lint sin errores, build limpio. Prisma regenerado y
  contenedores reiniciados. También se confirmó con el usuario (vía
  `AskUserQuestion`) el diseño de **G-1** (Horarios como plantilla
  reutilizable): referencia viva, no copia al aplicar.
- **2026-08-24**: entregado G-1 (Horarios como plantilla reutilizable,
  referencia viva) — módulo `plantillas-horario/` completo (catálogo,
  días, predeterminada auto-asignable), `AsistenciaService` (G-4)
  migrado a resolver el horario efectivo vía `PlantillasHorarioRepository.
  resolverDiasEfectivos()`. Verificado: tsc limpio, **745 unitarios + 179
  e2e, todos verdes** (una corrida tuvo un OOM transitorio de un worker
  de Jest en Windows, no relacionado al código — la repetición inmediata
  dio exit 0 limpio), lint sin errores, build limpio. Con esto, la
  sección **G** (RRHH) queda completa salvo G-2/G-6 (🟧) y G-9 (🟥,
  hardware).
- **2026-08-24**: entregados F-8 (PWA instalable), J-1 (etiquetas ZPL/
  EPL), J-2 (catálogo de reportes ampliado) y J-3 (mensaje a cajas por
  Redis). J-4 (API keys con scopes) reclasificado a "diseño primero" —
  no existe API pública propia sobre la cual definir scopes. Sin
  migraciones en este lote (los cuatro ítems son aditivos sobre módulos
  existentes o infraestructura ya presente — Redis, service worker).
- **2026-08-24**: entregado G-2 (Tipos de Ausencia configurables), con
  alcance reducido a propósito de 🟧 a 🟨 — catálogo `TipoAusenciaConfig`
  (6 filas fijas por tenant, una por valor del enum `TipoAusencia`) en
  vez de reemplazar el enum por un catálogo libre (VACACIONES es
  legalmente especial; en RD los tipos de ausencia no son algo que un
  negocio necesite inventar).
- **2026-08-24**: entregado G-6 (Deducciones de nómina configurables),
  alcance reducido de 🟧 a 🟨 — tasas/topes de TSS movidos a
  `Configuracion` (7 claves nuevas, sin modelo/migración nueva), ISR
  intacto en código a propósito. Con esto, la sección **G** (RRHH)
  queda completa salvo G-9 (🟥, hardware).

## Sugerencia de por dónde arrancar

Con el catálogo ya corregido, el lote E-3/E-5/E-9/E-11/F-2/F-4/F-8/G-1/
G-2/G-3/G-4/G-5/G-6/G-7/G-8/B-2/B-3/B-6/B-7/B-8/J-1/J-2/J-3 entregado y
verificado (tsc + suite unitaria + e2e + lint + build, todo verde), ya
no quedan ítems con el matiz "ya lo teníamos parcial" original (los 5
que tenía esa nota — B-1, E-1, E-5, E-11, G-7 — están todos resueltos
o, en el caso de E-1, siguen como brecha real confirmada sin cambios).
La sección **G** (RRHH) queda completa salvo G-9 (🟥, depende de
hardware). De la sección **B** solo queda B-5 (🟥, e-CF real) sin
bloqueo — **B-9 está deliberadamente pausado** (el usuario
pidió evaluarlo con más calma, no retomar sin avisar) y B-4 (🟧) no es
bloqueante. La sección **J** queda completa salvo J-4 (🟥, diseño
primero). La sección **F** queda completa salvo F-9 (🟥, diseño
primero). Quedan además C-2 (multi-moneda, 🟧), E-6/E-8 (🟧) y H-3
(🟧) sin verificar en detalle contra el código. Los 🟥 con "diseño
primero" conviene agruparlos en su propia sesión de planeamiento cuando
se prioricen, siguiendo la misma mecánica que Sucursales (Fase 8) y PIN
(Fase 9): presentar el diseño, resolver casos límite, y recién después
ejecutar.
