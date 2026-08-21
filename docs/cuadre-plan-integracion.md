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
- [ ] **B-2** 🟧 — **Secuencias de NCF por sucursal** (hoy `NcfAsignado` es
  `@@unique([tenantId, tipoNcf])`, sin sucursal) + **umbral de alerta**
  configurable ("quedan pocos comprobantes"). *Confirmado: brecha real, sin
  cambios — el módulo `ncf/` existe pero no tiene ninguno de los dos.*
- [ ] **B-3** 🟨 — **Leyes Fiscales**: % del ITBIS a pagar por norma/sector
  (ej. construcción). *Confirmado: brecha real, sin cambios.*
- [ ] **B-4** 🟨 — **Recargos de Factura**: cargos post-subtotal
  (Imprevistos, Viáticos, etc.). *Confirmado: brecha real, sin cambios.*
- [ ] **B-5** 🟥 *diseño primero* — **e-CF real (firma y envío a la DGII)**:
  Cuadre integra un proveedor certificado ("Pascal ECF") en vez de construir
  el firmador propio. *Confirmado: brecha real, ya documentada en
  ARCHITECTURE.md ("e-NCF propio... la firma/envío quedan fuera de esta
  fase a propósito").*
- [ ] **B-6** 🟧 — **Condición de pago con plazo explícito** (15/30/45/60/90
  días) con vencimiento auto-calculado. *Confirmado: brecha real — no hay
  ningún campo de plazo en `Factura`/`CrearFacturaDto`.*
- [ ] **B-7** 🟨 — **Toggle de ITBIS por línea** de factura. *Confirmado:
  brecha real, sin cambios.*
- [ ] **B-8** 🟨 — **Descuento general de documento** (% o $) sobre el
  subtotal completo. *Confirmado: brecha real — lo que existe (Ofertas de
  carrito) es automático, no un campo manual "aplicar X% a toda la
  factura".*
- [ ] **B-9** 🟨 — **Línea manual/libre en factura**, no ligada a un
  producto del catálogo. *Confirmado: `LineaFacturaDto.productoId` sigue
  siendo `@IsUUID()` obligatorio — brecha real.*

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
- [ ] **E-4** 🟧 — **Alertas de inventario segmentadas**: 4 categorías (Sin
  Stock / Stock Bajo / Por Vencer 7 días / Vencidos) con dashboard propio.
  *Confirmado: brecha real — el reporte hoy es un solo contador
  (`stockBajoConteo`).*
- [ ] **E-5** 🟧 *(alcance reducido)* — **Cliente: campos que faltan**.
  *YA tenemos `limiteCredito` (Decimal) y `esConsumidorFinal` (que ES el
  "cliente por defecto"/walk-in de Cuadre) en `model Cliente`. Lo que
  realmente falta: categoría/segmentación (catálogo propio) y comprobante
  fiscal por defecto (autoseleccionado al elegir el cliente en POS/
  Facturación).*
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
- [ ] **E-11** 🟨 *(alcance reducido)* — **Formas de pago: lo que falta**.
  *YA tenemos `requiereReferencia` (Boolean) en `model FormaPago` — la
  parte de "requiere referencia configurable" de la comparación original
  estaba mal. Lo que realmente falta: la clasificación de "tipo"
  estructurada (7 categorías en vez de los flags puntuales
  `esBono`/`esEfectivo` actuales) y el concepto de "Crédito Cliente" (pagar
  contra cuenta corriente).*

## F — POS

- [x] **F-1** ✅ *ya cubierto, no era una brecha real* — **Modal de descuento
  dedicado**: `ModalDescuento` en `TurnoCajaDetalle.tsx` ya tiene % o monto
  fijo, checkbox por línea del carrito + "seleccionar todos".
- [ ] **F-2** 🟨 — **Tipo de NCF integrado al selector de cliente**, con
  botón "Nuevo cliente" inline sin salir de la venta. *Confirmado: brecha
  real — no hay ninguna selección de `tipoFactura` en el flujo del POS.*
- [x] **F-3** ✅ *ya cubierto, no era una brecha real* — **Panel "Facturas de
  la sesión"**: la sección "Ventas del turno" en `TurnoCajaDetalle.tsx` ya
  lista todo lo vendido en el turno actual, inline, con imprimir/anular por
  fila.
- [ ] **F-4** 🟧 — **Canales de entrega del recibo**: email y WhatsApp
  además de imprimir. *Confirmado: brecha real, sin cambios.*
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
- [ ] **F-8** 🟨 — **PWA instalable**: manifest + service worker básico.
  *Confirmado: no existe ningún manifest/service worker — brecha real.*
- [ ] **F-9** 🟥 *diseño primero* — **Impresión local ESC/POS + apertura de
  gaveta**: agente descargable. *Confirmado: brecha real, ya documentada en
  ARCHITECTURE.md.*

## G — RRHH

- [ ] **G-1** 🟧 — **Horarios como plantilla reutilizable**. *Confirmado:
  `HorarioEmpleado` sigue siendo una fila por `empleadoId` sin concepto de
  plantilla — brecha real.*
- [ ] **G-2** 🟧 — **Tipos de Ausencia configurables por tenant**.
  *Confirmado: `TipoAusencia` sigue siendo un enum fijo de Prisma
  (VACACIONES/ENFERMEDAD/PERMISO/INJUSTIFICADA/MATERNIDAD_PATERNIDAD/OTRO)
  — brecha real.*
- [ ] **G-3** 🟨 — **Aprobación de registros de asistencia**. *Confirmado:
  `RegistroAsistencia` solo tiene `tardanza` (Boolean), sin estado de
  aprobación — brecha real.*
- [ ] **G-4** 🟨 — **Umbral de horas extra + tolerancia de salida
  anticipada** configurables. *Confirmado: brecha real, sin cambios.*
- [ ] **G-5** 🟨 — **Calendario de feriados**. *Confirmado: no existe
  ningún modelo `Feriado` — brecha real.*
- [ ] **G-6** 🟧 — **Deducciones de nómina configurables** (AFP/SFS) —
  **mantener el ISR calculado en código** (`isr.util.ts`). *Confirmado: no
  existe ningún modelo de deducciones configurables — brecha real, sin
  cambios en la recomendación de no tocar el ISR.*
- [x] **G-7** 🟨 *(alcance reducido)* — **Nómina: lo que falta de
  período/puesto**. `TipoPeriodoNomina` ganó `SEMANAL` y `BIMENSUAL`
  (`FACTOR_PERIODO_NOMINA` en `nomina-config.ts`): `SEMANAL` = 7 días
  del divisor legal 23.83 (no un genérico mes/4); `BIMENSUAL` = mismo
  factor 0.5 que `QUINCENAL` (RAE: "dos veces al mes", no "cada dos
  meses"). Migración `20260821140000_periodo_nomina_semanal_bimensual`.
  Entregado 2026-08-21. El filtrado por Puesto sigue faltando por
  completo (depende de G-8, que tampoco existe) — queda fuera de este
  ítem.*
- [ ] **G-8** 🟨 — **Catálogo de "Puestos"** estructurado. *Confirmado: no
  existe ningún modelo `Puesto` — brecha real, sin cambios.*
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

- [ ] **J-1** 🟨 — **Impresora de etiquetas ZPL/EPL**. *Confirmado: brecha
  real, sin cambios.*
- [ ] **J-2** 🟨 — **Catálogo de reportes ampliado** (por vendedor, código
  alterno, rentabilidad). *Confirmado: brecha real, sin cambios.*
- [ ] **J-3** 🟨 — **"Mensaje a cajas"** (broadcast a terminales POS). *No
  re-verificado a fondo — de alcance tan chico que no cambia la
  priorización; asumir brecha real hasta confirmar si se prioriza.*
- [ ] **J-4** 🟨 — **API keys con scopes granulares**. *No re-verificado a
  fondo (no aplica hasta que exista una API pública propia) — mismo
  criterio que J-3.*

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

## Sugerencia de por dónde arrancar

Con el catálogo ya corregido y E-3/E-9/G-7 entregados, los candidatos de
mejor esfuerzo/impacto que quedan son **E-5** y **E-11** (ambos con
alcance reducido — campos puntuales sobre modelos que ya existen, ver
arriba). Los 🟥 con "diseño primero" conviene agruparlos en su propia
sesión de planeamiento cuando se prioricen, siguiendo la misma mecánica
que Sucursales (Fase 8) y PIN (Fase 9): presentar el diseño, resolver
casos límite, y recién después ejecutar.
