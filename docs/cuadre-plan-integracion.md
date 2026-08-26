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

- [x] **A-1** 🟥 *diseño primero* — **Comisiones de venta de punta a punta**:
  % de comisión por producto y por oferta, cálculo al facturar, 3 reportes
  (por venta/vendedor/producto). *Confirmado: no existía ningún campo de
  comisión en `schema.prisma` — brecha real.* Decisiones confirmadas con
  el usuario: (1) `Producto.porcentajeComision`/`montoComisionFijo`
  mutuamente excluyentes; (2) base de cálculo = monto neto SIN ITBIS,
  después de descuento; (3) se acredita solo si la factura tiene
  `vendedorEmpleadoId` (ventas de POS con vendedor elegido, ítem F-2) —
  sin fallback al `vendedorId` (User) de facturación normal; (4) al
  anular la factura, sus comisiones se marcan `anulada:true` (nunca se
  borran). Entregado: módulo `comisiones/` (`ComisionVenta`, generado
  vía Event Bus — `ComisionesEventosService` reacciona a
  `factura.creada`/`factura.anulada`, mismo patrón que Contabilidad),
  `LineaFactura.pagaComision` conecta con el `pagaComision` de A-2
  ("todo o nada" si la oferta ganadora no paga comisión), 3 reportes de
  solo lectura (`GET /comisiones/por-venta`\|`por-vendedor`\|
  `por-producto`, permiso nuevo `comisiones.ver`). Frontend: campos de
  comisión en el formulario de Producto, pestaña "Comisiones" en
  Reportes. Migración `20260828100000_comisiones_venta`. Entregado
  2026-08-24.
- [x] **A-2** 🟥 *diseño primero* — **Motor de Ofertas ampliado**: agregar
  tipos BOGO ("Compra X Lleva Y", "Segunda Unidad"), tope de descuento
  máximo, control de acumulabilidad, prioridad entre ofertas simultáneas.
  Extiende `OfertasService`/`model Oferta` existente (Fase 4b), no es un
  módulo nuevo desde cero. *Confirmado: `Oferta` solo tenía
  `TipoDescuentoOferta` (Porcentual/Fijo), sin `descuentoMaximo`,
  `acumulable`, `prioridad` ni `pagaComision` — brecha real.* Decisiones
  confirmadas con el usuario: (1) `porcentajeDescuentoLlevar` de BOGO
  configurable (0-100, no fijo en "gratis"), para cubrir tanto "Compra 2
  Lleva 1 Gratis" como "Segunda Unidad al 50%"; (2) combinación de
  ofertas simultáneas: se SUMAN las marcadas `acumulable`, se toma la
  MEJOR entre las no acumulables (desempate por `prioridad`), y el
  resultado final es el mayor entre ambos totales — nunca se combinan
  entre sí. Entregado: `TipoDescuentoOferta.BOGO` +
  `comprarCantidad`/`llevarCantidad`/`porcentajeDescuentoLlevar` (`Oferta.
  valor` ahora nullable, BOGO no lo usa; rechaza `alcance: CARRITO`),
  `descuentoMaximoMonto`, `acumulable`/`prioridad` con el algoritmo de
  combinación en `OfertasService.combinarDescuentos`, `pagaComision`
  (guardado sin efecto hasta el ítem A-1). Frontend: `<input
  type="datetime-local">` + conversión a UTC (`aFechaHoraUtc`) para
  "vigencia por hora". Migración `20260828090000_ofertas_bogo_acumulable`.
  Entregado 2026-08-24.
- [x] **A-3** 🟥 *diseño primero* — **Lealtad / puntos / recompensas**:
  acumulación (por monto o unidad), canje, expiración opcional. Apple/Google
  Wallet queda fuera de un primer corte. *Confirmado: cero mención de
  "lealtad"/"puntos" en todo el schema — brecha real.* Decisiones
  confirmadas con el usuario: (1) canje como forma de pago en el
  checkout (`FormaPago.esPuntosLealtad`, mismo criterio que Bonos), no
  un endpoint separado de saldo a favor; (2) expiración por lote de
  acumulación vía cron diario (FEFO, mismo criterio que lotes de
  inventario), no un vencimiento global simple; (3) base de cálculo
  (Subtotal/Total) configurable por tenant, igual que Cuadre. Entregado:
  módulo `lealtad/` (`ConfiguracionLealtad` fila única por tenant,
  `MovimientoLealtad` ledger), acumulación vía Event Bus
  (`LealtadEventosService`, nunca bloquea la venta), canje síncrono
  dentro de la transacción de la venta (`LealtadService.
  procesarPagoEnTx`, igual patrón que `BonosService`), cron diario de
  expiración (`LealtadExpiracionCronService`), reversión al anular
  factura (limitación conocida y documentada: un canje reintegrado no
  reconstruye los lotes exactos originales, pero el saldo siempre queda
  correcto). Frontend: panel "Lealtad" en Admin, columna de puntos +
  historial en Contactos, hint de saldo en el checkout del POS.
  Migraciones `20260829090000_lealtad_puntos_enum` +
  `20260829090001_lealtad_puntos`. Entregado 2026-08-24.
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
- [x] **B-4** 🟨→🟧 *(corrección de tamaño)* — **Recargos de Factura**:
  cargos post-subtotal (Imprevistos, Viáticos, etc.), con "% gravado con
  ITBIS" opcional y orden configurable. *Confirmado: brecha real, pero
  más grande de lo catalogado: necesita una tabla hija nueva para los
  recargos aplicados a cada factura (`FacturaRecargo`, patrón
  `FacturaPlataformaLinea`) MÁS cambios en `calcularLineasYTotales()` MÁS
  actualizar impresión/PDF para mostrarlos — no es un campo suelto como
  B-7/B-8, es una entidad nueva.* Entregado: `FacturaRecargo` (concepto
  texto libre, monto, `gravado`, `orden`) — sin catálogo `RecargoFactura`
  reusable aparte, mismo criterio minimalista que
  `FacturaPlataformaLinea` (un recargo es puntual por factura, no una
  entidad de configuración). `CrearFacturaDto.recargos?[]`, calculado en
  `FacturacionService.crear()` (no dentro de `calcularLineasYTotales`,
  que ni `cotizar()` ni el POS usan) — se suman después del descuento
  general de documento, ITBIS del recargo `gravado:true` a la tasa
  `ITBIS_GENERAL` del tenant (`ConfiguracionesService`, mismo patrón que
  `POS_TOLERANCIA_ARQUEO`). Ignorados en NOTA_CREDITO/NOTA_DEBITO, mismo
  criterio que B-8. PDF/ticket térmico muestran una línea por recargo
  entre Descuento e ITBIS. UI en `ModalNuevaFactura` (Facturación
  directa únicamente — Cuadre tampoco lo tiene en Cotizaciones/POS).
  Migración `20260826014413_factura_recargos`. Verificado en vivo
  (factura de prueba con un recargo gravado — totales exactos
  confirmados contra la base de datos). Entregado 2026-08-26.
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

- [x] **C-1** 🟥→✅ *diseño primero, entregado* — **AZUL y CARDNET** para
  las ventas del propio tenant, como **Payment Link** (decisión ya
  confirmada con el usuario — la terminal física Pin Pad queda fuera).
  *Confirmado: brecha real — `PasarelaPagoAdapter` (`facturacion-
  plataforma/pasarela/`) es para la facturación de PLATAFORMA a los
  tenants, un contexto totalmente distinto a que el CLIENTE de un tenant
  le pague una `Factura` de ese tenant.* Contratos reales de ambos
  proveedores (docs. oficiales `dev.azul.com.do`/`developers.cardnet.
  com.do`) resultaron completamente distintos entre sí — **AZUL "Página
  de Pagos"**: formulario HTML firmado con HMAC-SHA512 (una sola
  `AuthKey`, no Auth1/Auth2 — eso es de su API SOAP separada), sin
  sesión de servidor; **CardNet "Botón de Pago — Web con Pantalla"**:
  API REST de sesiones (`POST /sessions` → form POST a `/authorize` →
  `GET /sessions/{id}?sk=` para el resultado autoritativo), sin firma
  ni push de resultado. Ninguno encajaba en el contrato `{url,
  referenciaExterna}` de `PasarelaPagoAdapter` — se construyó una
  interfaz local nueva (`pasarela-cobro/adapters/`) que admite tanto
  redirect simple como formulario POST autoenviado. Entregado en 3
  commits: (1) infra común — `PasarelaConfigTenant` (credenciales por
  tenant, mismo cifrado que `WhatsappConfigTenant`), `SesionCobroFactura`
  (ledger de idempotencia real por `referenciaExterna`, deliberadamente
  distinto del atajo "si ya está pagada" de `PagoPlataforma` — acá se
  permiten pagos parciales, ese atajo dejaría de ser seguro),
  `Pago.userId` nullable (un pago de gateway no tiene operador humano,
  mismo criterio que `PagoPlataforma.registradoPorId`); (2) AZUL
  end-to-end; (3) CardNet end-to-end. Decisiones confirmadas con el
  usuario (`AskUserQuestion`): construir los dos proveedores en la
  misma tanda (no uno primero); permitir **pago parcial** desde el link
  público (no solo el saldo completo); el link se genera con un **botón
  manual** en el detalle de la Factura, no automático. Ver
  ARCHITECTURE.md para el detalle de diseño (incluye por qué se "forja"
  `request.user` para reusar `FacturacionService.registrarPago` desde
  el controller público). Verificado end-to-end contra AMBOS sandboxes
  reales (formularios llegaron a `pruebas.azul.com.do`/`labservicios.
  cardnet.com.do`, credenciales de prueba rechazadas como se esperaba) y
  con retornos simulados/reales: idempotencia confirmada, pago parcial
  no marca la factura pagada, `Pago.userId` queda `null`. Migraciones
  `20260904090000_pasarela_cobro`, `20260905090000_pasarela_cobro_
  ajuste_azul`, `20260906090000_pasarela_cobro_ajuste_cardnet`.
  Entregado 2026-08-25.
- [x] **C-2** 🟧→🟥 *(corrección — diseño primero)* — **Multi-moneda de
  punta a punta**. *Confirmado: brecha real en comportamiento —
  `TenantSettings.moneda` (String, default "DOP") era un campo muerto,
  no se leía/usaba en ningún lado del backend. Pero "de punta a punta"
  resultó ser más grande de lo catalogado al verificar el alcance real:
  ni `Factura`/`LineaFactura` ni `AsientoContable`/`LineaAsiento` ni
  `Producto.precios` tenían NINGUNA columna de moneda — todo el sistema
  asumía DOP implícito.* Decisiones confirmadas con el usuario (alcance
  acotado a propósito, comparable a A-2/D-1): (1) `subtotal`/`itbis`/
  `total` de `Factura` NUNCA cambian de significado — siguen siendo
  SIEMPRE DOP (cero riesgo para NCF/contabilidad/reportes/pagos, que ya
  los leen así); se agregan `moneda`/`tasaCambio` (snapshot) +
  `subtotalMoneda`/`itbisMoneda`/`totalMoneda`, puramente de
  presentación; (2) contabilidad siempre en DOP, sin libro mayor
  multi-moneda ni ganancia/pérdida cambiaria (fuera de alcance,
  documentado); (3) precios/costos de catálogo siguen siempre en DOP —
  la conversión es solo al facturar. Entregado: catálogo
  `TasaCambio` (manual, sin feed automático, mismo criterio que
  Cuadre), `CrearFacturaDto.moneda?` (400 si no hay tasa configurada),
  `FacturacionService.resolverMoneda()`, equivalente mostrado en PDF y
  ticket térmico ("Equivalente: USD 123.45"). Frontend: panel "Tasas de
  cambio" en Admin, selector de moneda en Facturación (fuera de
  alcance: Cotizaciones/Remisiones/cotizar de POS, que siguen solo en
  DOP). Migración `20260831090000_multi_moneda`. Entregado 2026-08-24.*

## D — Autorización de acciones sensibles

- [x] **D-1** 🟧 *diseño primero* — **Capa 2 de autorización (opcional) por
  un segundo usuario real** (email con código de un solo uso) para
  anulaciones/devoluciones grandes. *Confirmado: brecha real — nuestro
  PIN de Fase 9 seguía siendo 100% autoservicio.* Decisiones confirmadas
  con el usuario: (1) toggle simple por tenant, SIN umbral de monto —
  igual que Cuadre; (2) destinatario del código: encargado de la
  sucursal (asignado vía `UsuarioSucursal` + `pos.supervisar`) o, si no
  hay ninguno, el/los Admin Total — se manda a TODOS los elegibles
  (el sistema no puede detectar "no está en el lugar", mandar a todos
  es el equivalente práctico). Entregado: módulo `autorizaciones/`
  (`CodigoAutorizacion`, bcrypt + expiración de 5 min + máx. 5
  intentos), `POST /facturas/:id/solicitar-autorizacion` y
  `POST /pos/devoluciones/solicitar-autorizacion`, `codigoAutorizacion?`
  en `anular()`/`registrarDevolucion()` — se SUMA al PIN de Fase 9, no
  lo reemplaza. Toggles `AUTORIZACION_2FA_ANULAR`/`_DEVOLUCION`
  (Admin → Facturación → Autorizaciones). De paso, se corrigió un bug
  preexistente: `ModalAnularVenta` (POS) nunca mandaba el PIN al
  backend. Migración `20260827090000_codigos_autorizacion`. Entregado
  2026-08-24.

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
  **Corrección (Parte 8, 2026-08-26)**: lo entregado son 4 tarjetas
  pasivas — Cuadre además tiene una página dedicada con drill-down por
  producto y un popup proactivo al iniciar sesión, ninguno de los dos
  construido acá. Ver **E-12**, ítem nuevo para esa parte del gap.
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
- [x] **E-6** 🟧 — **Cierres de caja como dashboard**: desglose de ventas
  por TODAS las formas de pago (no solo efectivo), estado "Pendiente
  revisión". *Confirmado: brecha real — `EstadoTurnoCaja` solo tenía
  `ABIERTO`/`CERRADO`.* Entregado: `EstadoTurnoCaja.PENDIENTE_REVISION`
  (una diferencia fuera de tolerancia ya no cierra directo — queda acá
  hasta que un supervisor confirma vía `PATCH /pos/turnos/:id/revisar`);
  desglose de ventas por TODAS las formas de pago en el resumen del
  cierre (`DesglosePorFormaPago`, agrupa `pagosVenta` de las facturas
  del turno); reporte-dashboard `GET /pos/turnos/reporte-cierres` (4
  agregados: Total Ventas, Sobrantes, Faltantes, Diferencia Total +
  exactas), panel `CierresCajaDashboard.tsx` en `/pos` (solo
  `pos.supervisar`). Migración
  `20260826120000_turno_caja_pendiente_revision`. Entregado 2026-08-24.
- [x] **E-7** 🟥 *diseño primero* — **"Caja" como entidad propia**
  (restricción de catálogo por terminal). *Confirmado: brecha real, no
  existía ningún modelo `Caja` — era literalmente `Bodega`+`TurnoCaja`.*
  Decisiones confirmadas con el usuario: (1) una Caja pertenece a UNA
  Bodega (no independiente); (2) restricción como lista blanca combinada
  (categorías OR productos) — sin ninguna asignación, vende todo; (3) el
  bloqueo se aplica SOLO en el checkout del POS, nunca en Facturación
  directa. Entregado: módulo `cajas/` (`Caja`, `CajaCategoria`,
  `CajaProducto`, `CajaProductoFavorito`), `TurnoCaja.cajaId` opcional
  (sin elegir Caja, el POS funciona igual que antes),
  `PosService.registrarVenta()` valida las líneas contra la Caja del
  turno antes de facturar. "Print Service" (impresión ESC/POS local por
  Caja) queda deliberadamente FUERA — es el ítem F-9, ya separado.
  Frontend: panel "Cajas" en Admin, selector opcional de Caja al abrir
  turno. Migración `20260830090000_cajas`. Entregado 2026-08-24.
- [x] **E-8** 🟧 *(matiz + alcance reducido)* — **Producto: campos
  avanzados** — precio variable, presentación de compra con conversión
  bulto→unidad, "es ingrediente", "permite devolución" por producto,
  códigos alternos múltiples. *Confirmado en su mayoría real, con un
  matiz: `unidadMedida` YA existía como `String @default("UND")` libre
  — no era un campo ausente, solo sin lista cerrada.* Entregado:
  `Producto.precioVariable` (input de precio editable en el carrito del
  POS), `esIngrediente` (informativo), `permiteDevolucion` (default
  `true`, rechaza con 400 una NOTA_CREDITO si es `false`), `unidadMedida`
  ahora validado contra una lista cerrada de 10 valores (`@IsIn`, sin
  migrar la columna). **Deliberadamente fuera, cada uno más grande que
  un campo suelto**: "Requiere OTP" (flujo de autorización nuevo, mismo
  nivel de diseño que el PIN de Fase 9), presentación de compra con
  conversión bulto→unidad (toca Compras real), códigos alternos
  múltiples (tabla hija nueva + matching de escaneo en POS). Migración
  `20260826110000_producto_campos_avanzados`. Entregado 2026-08-24.
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
- [ ] **E-12** 🟧 — **Página dedicada de Alertas de Inventario + popup
  proactivo al iniciar sesión**. *Confirmado (Parte 8, auditoría en
  vivo): `/inventory-alerts` en Cuadre es una página propia (4 tabs:
  Resumen/Stock Bajo/Sin Stock/Por Vencer) con drill-down real —
  tabla Producto/Bodega/Stock Mínimo por cada categoría, con "Ver
  todos" desde el resumen — y un modal que aparece solo al entrar al
  Dashboard (una vez por sesión, se suprime en refrescos siguientes)
  si hay algo en cualquiera de las 4 categorías, con botón directo
  "Ver Alertas →". Nuestro E-4 (entregado 2026-08-24) solo cubre las 4
  tarjetas de conteo en `Dashboard.tsx` — sin página propia navegable
  y sin ningún aviso proactivo: si nadie entra al Dashboard a mirar,
  nadie se entera.* Alcance propuesto: página nueva (ej.
  `/inventario/alertas`, reusa los 4 números que ya calcula `GET
  /reportes/dashboard`) con 4 tabs y un endpoint de listado por
  categoría (`GET /inventario/alertas?categoria=sinStock|stockBajo|
  porVencer|vencidos`, paginado igual que el resto de listados); popup
  al primer acceso al Dashboard de la sesión (sessionStorage en el
  frontend para no repetir — no hace falta persistir "ya visto" en el
  backend). Diseño primero: confirmar con el usuario si el popup debe
  respetar permisos (ej. no mostrarse a un Cajero sin `inventario.ver`)
  antes de implementar.

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
- [x] **G-10** 🟨 — **Vínculo Empleado ↔ Usuario**. *`Empleado.userId` ya
  existía en el schema desde antes, sin exponerse en ningún formulario —
  brecha de UI, no de modelo.* Análisis confirmado con el usuario (no se
  fusionó Empleado con Usuario ni se generó un Empleado automático al
  crear un Usuario — son conceptos que a veces coinciden y a veces no:
  un Usuario puede no ser nómina, ej. un contador externo con acceso al
  sistema). Entregado: `GET /nomina/empleados/usuarios-disponibles`
  (permiso `nomina.editar`, delega en `UsuariosService.listar` — nunca
  expone `passwordHash`), combobox de usuario en el formulario de
  Empleado (ahora compartido crear/editar, antes solo existía alta),
  conflicto `P2002` de `userId` ya vinculado devuelve error claro. Sin
  migración. Entregado 2026-08-25.
- [x] **G-11** 🟨 — **Horas extra conectadas al recibo de nómina**.
  *Confirmado: `RegistroAsistencia.horasExtra` (G-4) se calculaba y
  mostraba en Asistencia, pero `PeriodosNominaService.generarPeriodo()`
  nunca lo leía — el recibo de nómina lo ignoraba por completo.*
  Entregado: `AsistenciaRepository.sumarHorasExtraEnRango()`,
  `RECARGO_HORAS_EXTRA = 1.35` (135%, primera categoría — **sin
  verificar contra fuente oficial**, mismo disclaimer que ISR/TSS),
  `ReciboNomina.montoHorasExtra` sumado al salario neto (no afecta base
  de TSS/ISR, mismo criterio conservador que `descuentoAusencias`). El
  asiento contable automático (`AsientosContablesService.
  generarDesdeNomina`) se actualizó para sumar `totalHorasExtra` también
  al débito (`costoLaboral`) — si no, el asiento hubiera quedado
  descuadrado en cualquier período con horas extra. Migración
  `20260901090000_recibo_nomina_horas_extra`. Entregado 2026-08-25.
- [x] **G-12** ✅ *reconfirmado, sin cambios* — **"Marcar entrada" al
  hacer login**. El usuario preguntó de nuevo si el login debería marcar
  la entrada automáticamente; se reconfirmó la decisión ya tomada
  anteriormente (documentada en `MarcarAsistenciaWidget.tsx`): login y
  marcar asistencia quedan separados a propósito — un usuario puede
  loguearse sin estar físicamente llegando a trabajar (ej. revisar algo
  desde casa), así que fusionar ambos generaría marcas de asistencia
  falsas. Sin cambios de código.

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
- [x] **H-2** 🟥 *diseño primero, alcance grande* — **WhatsApp
  conversacional con IA**: bot que responde automáticamente a clientes.
  *Confirmado: brecha real — nuestro canal de WhatsApp solo envía
  notificaciones salientes, sin recepción/respuesta automática.*
  **Nota del usuario (2026-08-24, decisión pendiente)**: antes de
  diseñar el flujo de negocio (qué preguntas responde el bot, cuándo
  escala a un humano, etc.) hay que decidir el mecanismo de recepción/
  orquestación — el proyecto ya tiene **n8n** self-hosted en
  `docker-compose.yml`, pero hoy es solo consumidor de los webhooks
  salientes existentes (`docs/ARCHITECTURE.md`, sección "n8n") — nunca
  se usó para recibir mensajes entrantes ni orquestar una conversación.
  Las opciones reales a evaluar cuando se retome: (a) n8n recibe el
  webhook entrante de Twilio y orquesta todo (llamada a IA, respuesta),
  dejando el backend de Nest fuera del loop conversacional; (b) un
  endpoint nuevo en el backend (`POST /webhooks/whatsapp-inbound` o
  similar) que reusa `IaClientService` directo, sin n8n; (c) un híbrido.
  Explícitamente diferido — no arrancar el diseño de negocio hasta
  resolver esto primero.
  **H-2a entregado (2026-08-25)**: decisión del usuario — construir ya
  el formulario de configuración por tenant (credenciales Twilio +
  proveedor/modelo/API key de IA + historial de conversación), sin
  esperar a resolver el mecanismo de H-2b. Módulo `whatsapp-config/`,
  panel en Admin → Integraciones → WhatsApp, mismo patrón de secretos
  cifrados que `plataforma-config/` pero tenant-scoped. **Sin botón de
  "Probar conexión"** (pedido explícito) y **sin conectar con nada
  todavía** — `WhatsAppChannel.enviar()` sigue leyendo `TWILIO_*` de
  `process.env` (nivel plataforma), este formulario solo persiste
  datos. H-2b (el bot en sí) sigue bloqueado por la misma decisión de
  mecanismo pendiente. Migración `20260903090000_whatsapp_config_tenant`.
  **H-2b entregado (2026-08-25)**: mecanismo resuelto a favor de
  **backend directo** (opción b) — n8n habría sido solo un intermediario
  sin acceso a Prisma tenant-scoped para casi ninguna parte real de la
  lógica (resolver tenant por número, descifrar credenciales, historial,
  IA con la clave del tenant). Webhook de Twilio (`POST
  /webhooks/whatsapp/inbound`, `@Public()`, clona el patrón de
  `pago-publico.controller.ts`/Stripe) verifica `X-Twilio-Signature`
  (HMAC-SHA1, `twilio-signature.util.ts`) con el `authToken` **del
  tenant** resuelto por el número de destino (`To`) — todos los tenants
  comparten la misma URL de webhook. **Decisiones de negocio confirmadas
  con el usuario**: (1) alcance = solo asistente general con un prompt
  de negocio configurado por el tenant, **nunca lee Factura/Cliente
  reales** (evita exponer datos de otro tenant si el matcheo por
  teléfono falla — no hay normalización de formato); (2) escalación a
  humano = notificación por email (reusa
  `NotificacionesService`/`EventBusService`, plantilla
  `whatsapp_requiere_atencion`) + bandeja simple en Admin → Integraciones
  → "Bandeja WhatsApp" (responder manual, marcar atendido) — **sin chat
  en vivo**; (3) abuso = tope diario de respuestas de IA configurable
  por tenant (`WhatsappConfigTenant.limiteRespuestasDiarias`), al
  llegar al tope responde un mensaje fijo sin llamar la IA (y también
  escala). La IA responde ÚNICAMENTE en JSON estructurado
  (`{"respuesta","requiereHumano"}`) — si el parseo falla, fail-safe a
  `requiereHumano: true` con un mensaje genérico, nunca se arriesga una
  respuesta libre sin vetar. Nunca cae a la clave de Anthropic de la
  plataforma si el tenant no configuró la suya. Tabla nueva
  `WhatsappMensaje` (historial + `diaRD` denormalizado para el tope
  diario sin aritmética de fechas). Módulo `backend/src/whatsapp-bot/`.
  Migración `20260907090000_whatsapp_bot`.
- [x] **H-3** 🟧 *(alcance reducido a propósito)* — **Plantillas de
  documentos personalizables** (factura/recibo). *Confirmado: brecha
  real — `documento-pdf.ts`/`documento-ticket.ts` son generadores fijos
  en código, sin ningún editor. Matiz: en la auditoría, "Plantillas
  Docs" solo se vio como ítem de menú en Cuadre, nunca se exploró qué es
  editable — un editor visual completo sería una brecha de alcance
  desconocido, no algo para implementar a ciegas.* Entregado: logo +
  nota de pie configurables (Admin → Configuración general →
  Documentos), aplicados a Facturación/Cotizaciones/Remisiones (PDF y
  ticket térmico). Guardado en el store genérico `Configuracion`
  (`DOCUMENTO_LOGO`/`DOCUMENTO_NOTA_PIE`), sin claves nuevas en
  `CONFIGURACIONES_BASE`. Sin migración. Entregado 2026-08-24.
- [x] **H-4** 🟧 — **Las notificaciones de Cotización/Factura no llevan el
  documento** — el cliente recibe un aviso de texto sin forma real de
  ver qué le mandaron. *Encontrado revisando nuestro propio flujo de
  "enviar" a pedido del usuario (2026-08-26), no por comparación directa
  contra Cuadre (no se confirmó qué manda exactamente su botón "Enviar
  Cotización" — no se probó en vivo para no disparar un envío real a un
  cliente real). Confirmado en el código: `NotificacionesService.
  alFacturarse`/`alEnviarCotizacion` (factura_creada/cotizacion_enviada)
  y `FacturacionService.enviarRecibo` (factura_recibo, envío manual)
  arman sus `variables` con solo nombre/número/total/fecha — ningún link
  ni adjunto. `EmailChannel.enviar()` manda `html` puro a `nodemailer.
  sendMail()` sin `attachments` (nodemailer ya soporta attachments
  nativo, no hace falta una librería nueva). El cliente recibe "tu
  cotización #X por RD$Y fue enviada" y no tiene cómo ver las líneas,
  precios ni condiciones reales.* Alcance propuesto (diseño primero —
  toca 3 módulos y hay una decisión real de arquitectura): un link
  público de solo lectura (mismo patrón que `/pagar/:facturaId` de la
  pasarela de pago — sin autenticación, resuelto por id) para Factura/
  Cotización, agregado como variable `{{link}}` en las plantillas —
  resuelve EMAIL y WHATSAPP a la vez (WhatsApp no puede adjuntar un PDF
  sin usar mensajes de media de Twilio, un alcance mayor). Adjuntar el
  PDF al email además del link es un complemento menor, no un
  reemplazo (WhatsApp seguiría necesitando el link). Fuera de alcance
  de este ítem: dar a Remisiones el mismo flujo de envío que Cotización/
  Factura — hoy no tiene NINGÚN mecanismo de envío (ni botón, ni evento,
  ni endpoint) — confirmar con el usuario si hace falta antes de
  sumarlo, una remisión suele entregarse físicamente junto a la
  mercancía. Entregado: módulo público `documentos-publicos/`
  (`@Public()`, `PrismaService` global, mismo patrón que
  `pasarela-cobro/cobros-publicos`) con JSON + PDF de Factura/Cotización;
  páginas `/ver-factura/:id`/`/ver-cotizacion/:id` (calcadas de
  `CobroFactura.tsx`, sin flujo de pago); variable `{{link}}` nueva en
  `factura_creada`/`cotizacion_enviada`/`factura_recibo`; PDF adjunto en
  EMAIL (`EmailChannel.enviar()` gana `attachments`, WhatsApp se cubre
  solo con el link). `mapearFacturaAParams`/`mapearCotizacionAParams`
  extraídas a archivos propios para evitar un import circular entre
  `facturacion.service.ts` y `notificaciones.service.ts`. **De paso se
  encontró y corrigió un bug real**: el asiento contable de una factura
  con recargos (B-4) quedaba desbalanceado (el crédito a Ingresos no
  incluía el recargo crudo) — `FacturaCreadaPayload` gana `recargos`,
  sumado a Ingresos por Ventas en `AsientosContablesService.
  generarDesdeFactura`. Verificado en vivo (página pública sin sesión +
  PDF vía curl + asiento balanceado en la base de datos). Entregado
  2026-08-26.

## I — Contabilidad

- [x] **I-1** ~~🟥 *diseño primero*~~ **→ falso positivo, ya estaba
  construido** — **Cierre de período fiscal real**. *La ficha original
  decía "confirmado: brecha real, ya documentada en ARCHITECTURE.md" —
  pero ese texto de ARCHITECTURE.md (la explicación de "Resultado del
  Ejercicio") quedó desactualizado: `CierrePeriodoService.cerrarPeriodo`
  (`POST /contabilidad/cierre-periodo`, permiso
  `contabilidad.cerrarperiodo`, ya sembrado en `PERMISOS_BASE`) existe
  desde el 2026-08-17 (commit `9b12e4e`, ANTES de que arrancara esta
  auditoría de Cuadre) — traspasa el saldo neto de INGRESO/GASTO a
  Utilidades Retenidas con un asiento real, `validarFechaAbierta()`
  bloquea asientos manuales/gastos retroactivos contra un período ya
  cerrado, y tiene controller/repositorio/tests + vista propia
  (`CierrePeriodoView.tsx`) en Contabilidad → Cierre de período. La
  única brecha real, MENOR (matiz, no re-verificada con el usuario si
  vale la pena): Cuadre modela "Períodos Fiscales" como objetos
  discretos con nombre + fecha inicio + fecha fin (`/accounting/periods`
  — ej. "Enero 2026"), mientras que el nuestro es un cursor simple
  ("cerrar hasta esta fecha", en secuencia, sin objeto de período
  nombrado) — cosmético/organizativo, no afecta si el cierre "funciona
  de verdad". Corregido 2026-08-24, sin cambios de código (solo se
  actualizó la explicación de "Resultado del Ejercicio" en
  ARCHITECTURE.md, que sí estaba mal redactada).*

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

## K — Configuración general

*Sección nueva (2026-08-25), no venía del catálogo A-J original — salió
de comparar `app.cuadre.do/settings` contra `Admin.tsx` en una revisión
aparte.*

- [x] **K-1** 🟧 — **Consecutivos/numeración automática**. *Confirmado:
  Cotización/Remisión/Orden de compra/Caja pedían el número/código
  tipeado a mano en el formulario de creación — sin ningún contador
  centralizado (a diferencia de NCF, que sí es atómico desde siempre).*
  Decisión confirmada con el usuario (`AskUserQuestion`): alcance total
  — además de los 4 automáticos, Producto y CuentaContable **mantienen
  el campo de texto libre** y suman un botón "Asignar" para tomar el
  siguiente consecutivo cuando se quiera (no se les fuerza el
  automático). Entregado: modelo `Correlativo` (`@@unique([tenantId,
  tipo])`, prefijo/próximo número/dígitos editables desde Admin →
  Facturación → Consecutivos, mismo criterio que NCF), incremento
  atómico vía `{ increment: 1 }` (`CorrelativosRepository.
  siguienteEnTx`, calcado de `siguienteNcfEnTx`), consumido dentro de la
  misma transacción de creación en Cotizaciones/Remisiones/Compras/
  Cajas (`crearEnTx`). Seeding automático al aprovisionar un tenant +
  script de backfill (`correlativos:backfill`) para los ya existentes.
  Migración `20260902090000_correlativos`. Entregado 2026-08-25.

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
- **2026-08-24**: entregados B-2 (Secuencias de NCF por sucursal +
  umbral de alerta), F-4 (Entrega manual del recibo por email/
  WhatsApp), E-4 (Alertas de inventario segmentadas en el dashboard),
  E-8 (Producto: campos avanzados, alcance reducido — precioVariable/
  esIngrediente/permiteDevolucion, sin "Requiere OTP"/presentación de
  compra/códigos alternos múltiples) y E-6 (Cierres de caja como
  dashboard — estado PENDIENTE_REVISION, desglose por forma de pago,
  reporte-dashboard).
- **2026-08-24**: reclasificado C-2 (Multi-moneda de punta a punta) de
  🟧 a 🟥 *diseño primero* al verificar el alcance real — ninguna tabla
  de negocio (`Factura`/`AsientoContable`/`Producto.precios`) tiene
  columna de moneda hoy, es una decisión de arquitectura (tasa de
  cambio, ganancia/pérdida cambiaria, reportes DGII en DOP obligatorio),
  no un campo suelto. NO implementado.
- **2026-08-24**: entregado H-3 (Plantillas de documentos
  personalizables), alcance reducido a propósito — logo + nota de pie
  configurables (Admin → Documentos), aplicados a Facturación/
  Cotizaciones/Remisiones (PDF y ticket térmico). Un editor visual
  completo de plantillas queda fuera — en la auditoría, "Plantillas
  Docs" de Cuadre solo se vio como ítem de menú, nunca se exploró qué es
  editable. **Con este lote, todo el catálogo 🟨/🟧 sin "diseño primero"
  queda entregado** — lo único pendiente son los 🟥 (requieren diseño
  primero) y B-9/B-4/E-1 (pausados o no bloqueantes, ver "Sugerencia de
  por dónde arrancar").
- **2026-08-24**: entregado D-1 (Capa 2 de autorización), el primer 🟥
  atacado tras cerrar el catálogo 🟨/🟧 — diseño confirmado con el
  usuario vía `AskUserQuestion` (toggle simple sin umbral de monto;
  destinatario: encargado de sucursal con `pos.supervisar`, o Admin
  Total si no hay uno asignado, mandado a TODOS los elegibles). Módulo
  `autorizaciones/` (`CodigoAutorizacion`, bcrypt, expira en 5 min, máx.
  5 intentos), nuevos endpoints `solicitar-autorizacion` en Facturación
  y POS, se SUMA al PIN de Fase 9 (no lo reemplaza). De paso, corregido
  un bug preexistente: `ModalAnularVenta` (POS) nunca mandaba el PIN al
  backend. Migración `20260827090000_codigos_autorizacion`.
- **2026-08-24**: entregado A-2 (Motor de Ofertas ampliado), segundo 🟥
  atacado — diseño confirmado con el usuario vía `AskUserQuestion`
  (`porcentajeDescuentoLlevar` de BOGO configurable en vez de fijo en
  "gratis"; combinación de ofertas simultáneas = mayor entre "suma de
  acumulables" y "mejor no acumulable", nunca ambas sumadas).
  `TipoDescuentoOferta.BOGO`, `descuentoMaximoMonto`, `acumulable`/
  `prioridad`, `pagaComision` (inerte hasta A-1). Migración
  `20260828090000_ofertas_bogo_acumulable`.
- **2026-08-24**: entregado A-1 (Comisiones de venta de punta a punta),
  tercer 🟥 atacado — diseño confirmado con el usuario vía
  `AskUserQuestion` (comisión % o monto fijo mutuamente excluyentes por
  producto; base = monto neto sin ITBIS; se acredita solo con
  `vendedorEmpleadoId` asignado, sin fallback al `vendedorId`; se anula
  junto con la factura). Módulo `comisiones/`, generado vía Event Bus
  (`factura.creada`/`factura.anulada`, nunca bloquea la venta), conecta
  con el `pagaComision` de A-2 ("todo o nada"). Migración
  `20260828100000_comisiones_venta`.
- **2026-08-24**: entregado A-3 (Lealtad/puntos), cuarto 🟥 atacado —
  diseño confirmado con el usuario vía `AskUserQuestion` (canje como
  forma de pago en el checkout, igual que Bonos; expiración por lote vía
  cron diario FEFO; base de cálculo Subtotal/Total configurable por
  tenant). Módulo `lealtad/` (`ConfiguracionLealtad`, `MovimientoLealtad`),
  acumulación vía Event Bus, canje síncrono dentro de la transacción de
  la venta. Migraciones `20260829090000_lealtad_puntos_enum` +
  `20260829090001_lealtad_puntos`.
- **2026-08-24**: entregado E-7 ("Caja" como entidad propia), quinto 🟥
  atacado — diseño confirmado con el usuario vía `AskUserQuestion` (Caja
  pertenece a una Bodega; lista blanca combinada categorías/productos,
  sin asignación = vende todo; bloqueo solo en el checkout de POS).
  Módulo `cajas/`, `TurnoCaja.cajaId` opcional. Migración
  `20260830090000_cajas`.
- **2026-08-24**: I-1 (Cierre de período fiscal real) resultó ser un
  **falso positivo** — `CierrePeriodoService.cerrarPeriodo` ya existía
  desde el 2026-08-17 (commit `9b12e4e`, antes de esta auditoría), con
  controller, repositorio, tests, permiso y UI propia
  (`CierrePeriodoView.tsx`). Lo único desactualizado era la explicación
  de "Resultado del Ejercicio" en ARCHITECTURE.md, que decía "este
  sistema no implementa cierre de período" — corregida, sin tocar
  código de negocio (solo un comentario en `estados-financieros.
  service.ts`). Único matiz menor sin resolver, no reimplementado:
  Cuadre modela períodos fiscales como objetos discretos con nombre +
  fecha inicio/fin; el nuestro es un cursor simple en secuencia —
  cosmético, no afecta si el cierre funciona de verdad.
- **2026-08-24**: entregado C-2 (Multi-moneda de punta a punta), sexto
  🟥 atacado — diseño confirmado con el usuario vía `AskUserQuestion`
  (moneda + tasa + equivalente en DOP guardado; contabilidad siempre en
  DOP sin libro mayor multi-moneda ni ganancia/pérdida cambiaria;
  precios/costos de catálogo sin tocar, conversión solo al facturar).
  `subtotal`/`itbis`/`total` de `Factura` NUNCA cambian de significado
  (siguen SIEMPRE en DOP) — se agregan `moneda`/`tasaCambio`/
  `subtotalMoneda`/`itbisMoneda`/`totalMoneda`, puramente de
  presentación (equivalente mostrado en el documento impreso). Catálogo
  `TasaCambio` manual, sin feed automático. Migración
  `20260831090000_multi_moneda`.
- **2026-08-25**: análisis a fondo de Gestión Humana/Nómina y de
  Configuración (`app.cuadre.do/hr`, `/settings`) a pedido del usuario,
  con 4 ítems implementados en la misma tanda (uno por commit): **G-10**
  (vínculo Empleado↔Usuario, solo exponer el campo ya existente — no
  fusionar conceptos), **G-11** (horas extra conectadas al recibo de
  nómina, con el ajuste correspondiente al asiento contable para que
  siga cuadrando), **G-12** (re-confirmado con el usuario: "Marcar
  entrada" sigue separado del login, sin cambios) y **K-1**
  (Consecutivos automáticos — sección nueva K, no existía en el catálogo
  A-J original). De paso se investigó a fondo **C-1** (AZUL/CardNet
  Payment Link, contratos reales leídos) pero se decidió dejarlo fuera
  de este lote — ver la nota agregada en C-1. Queda pendiente **H-2a**
  (formulario de configuración de WhatsApp por tenant, entrega parcial
  de H-2 — decidido con el usuario construirlo ya, sin esperar la
  decisión de mecanismo de H-2b).
- **2026-08-25**: entregado **C-1** (AZUL/CardNet Payment Link),
  retomado tras el lote anterior con su propia conversación de diseño
  (`AskUserQuestion`). Los dos proveedores en la misma tanda, pago
  parcial permitido desde el link público, botón manual en Factura para
  generarlo — ver el detalle completo en el ítem C-1 arriba. Verificado
  end-to-end contra los sandboxes reales de ambos proveedores.
- **2026-08-25**: entregado **H-2b** (bot conversacional de WhatsApp),
  retomado con su propia conversación de diseño (`AskUserQuestion`):
  mecanismo backend directo (no n8n), alcance solo-asistente-general sin
  leer datos reales, escalación por notificación + bandeja simple sin
  chat en vivo, tope diario configurable por tenant — ver el detalle
  completo en el ítem H-2 arriba. Verificado end-to-end contra la API
  real de Twilio y de Anthropic (credenciales de prueba, incluyendo el
  camino de fail-safe con una clave de Anthropic inválida). En el
  camino se encontró y corrigió un bug real de scope-hoisting de Nest
  (un repositorio no puede mezclar `PrismaService` global y
  `TenantPrismaService` request-scoped en el mismo constructor).
- **2026-08-26**: auditoría en vivo dirigida a Facturación + Ventas
  completo (Parte 8 de `docs/cuadre-auditoria.md`), a pedido del
  usuario. Confirmó sin cambios los 5 gaps de Facturación ya trackeados
  (B-1/B-6/B-7/B-8 entregados, B-9 deliberadamente pendiente) y agregó
  **E-12** (página dedicada de Alertas de Inventario + popup proactivo
  al iniciar sesión — E-4 solo cubrió las tarjetas del dashboard, no la
  página navegable ni el aviso proactivo). Sin cambios de código en
  esta sesión — solo investigación y documentación.
- **2026-08-26**: a pedido del usuario, se confirmó en vivo que una
  Cotización de Cuadre nunca se convierte en Factura (documento de
  punta muerta) — reforzado en `cuadre-auditoria.md`, sin ítem nuevo
  porque ya lo teníamos resuelto de nuestro lado. Revisando el
  equivalente propio ("flujo de enviar"), se encontró y agregó **H-4**:
  las notificaciones automáticas/manuales de Cotización y Factura no
  llevan ningún link ni PDF adjunto — el cliente recibe solo un aviso
  de texto, sin forma real de ver el documento. Sin cambios de código
  — solo investigación y documentación.
- **2026-08-26**: entregados **B-4** (Recargos de Factura) y **H-4**
  (link público + PDF adjunto en notificaciones), primeros dos ítems
  del lote de Ventas/Facturación decidido con el usuario (ver nota del
  "Lote en curso" arriba). Al implementar B-4 se encontró y corrigió un
  bug real: el asiento contable de una factura con recargos quedaba
  desbalanceado (crédito a Ingresos no incluía el recargo crudo) — ver
  el detalle en el ítem H-4 (se corrigió en la misma sesión, al armar
  la verificación en vivo de H-4). Ambos verificados en vivo (factura
  de prueba con recargo → totales/asiento exactos contra la base de
  datos; página pública `/ver-factura/:id` sin sesión + PDF vía curl).

## Sugerencia de por dónde arrancar

**Estado actual: todo el catálogo 🟨/🟧 sin "diseño primero" está
entregado, y arrancó la ronda de ítems 🟥** (el usuario pidió seguir con
"todos, no parar hasta finalizar todo" — cada uno con su propia
conversación de diseño antes de tocar código). Lote 🟨/🟧 completo:
B-1/B-2/B-3/B-6/B-7/B-8, E-2/E-3/E-4/E-5/E-6/E-8/E-9/E-11, F-2/F-4/F-5/
F-8, G-1/G-2/G-3/G-4/G-5/G-6/G-7/G-8/G-10/G-11/G-12, H-3, J-1/J-2/J-3,
K-1 — todos verificados (tsc + suite unitaria + e2e + lint + build, todo
verde) y commiteados uno por uno. De los 🟥, ya entregados: **D-1, A-2,
A-1, A-3, E-7, C-2, C-1, H-2 (H-2a + H-2b)**. I-1 resultó falso positivo
(ya estaba construido). Con esto queda cerrado el lote de RRHH/
Consecutivos/Configuración del 2026-08-25 (G-10, G-11, G-12, K-1, H-2a),
C-1 (AZUL/CardNet Payment Link) y H-2b (bot de WhatsApp), los tres
retomados aparte el mismo día.

**Lote en curso, 2026-08-26** (Ventas/Facturación, decidido con el
usuario tras la auditoría Parte 8): B-4 (Recargos, entregado) y H-4
(link público + adjunto en notificaciones, entregado) — quedan
Remisión + stock ("Marcar entregada" pasa a descontar de verdad —
hallazgo nuevo, no tenía ítem propio) y B-9 (línea manual/libre,
retomado — el usuario volvió a traer el tema). Diseño completo en
`C:\Users\longb\.claude\plans\memoized-noodling-moore.md` — orden
sugerido: Remisión+stock → B-9 (riesgo creciente, lo más invasivo al
final).

Lo que queda, por categoría:
- **No bloqueante, sin implementar**: E-1 (Patrón Borrador→Confirmado en
  Compras/Ajustes/Transferencias, matiz).
- **🟥, pendientes de su propia conversación de diseño**: A-4,
  B-5, F-9, G-9 (hardware), J-4 (API keys, reclasificado — no aplica
  sin una API pública).

Todos los 🟥 restantes necesitan una conversación de alcance ANTES de
tocar código — mismo criterio que Sucursales (Fase 8), PIN (Fase 9) y
D-1:
presentar el diseño, resolver casos límite con el usuario, y recién
después ejecutar. Ninguno se debe empezar a implementar directo desde
este documento.
