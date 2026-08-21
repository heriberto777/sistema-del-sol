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
  puntual).
- Los ítems 🟥 llevan además una nota "**diseño primero**" — antes de
  escribir código hace falta una conversación de alcance (como se hizo con
  Sucursales/Fase 8 y PIN/Fase 9), no arrancar directo a implementar.
- Tres cosas están marcadas aparte al final ("Ya vamos adelante") — no son
  brechas, son áreas donde Sistema del Sol ya le gana a Cuadre. No las
  toquemos pensando que hay que "ponerse al día".
- **Antes de empezar cualquier ítem, verificar contra el código actual, no
  solo contra este documento.** La comparación original se armó describiéndole
  a los forks de auditoría "lo que ya tenemos" de memoria (a partir de
  CLAUDE.md), sin releer el código real — al empezar F-1 se descubrió que
  ya estaba construido (`ModalDescuento` en `TurnoCajaDetalle.tsx`), igual
  que F-3 y F-6. Los tres quedaron corregidos abajo. Puede haber más falsos
  positivos parecidos en el resto del catálogo.

---

## A — Motores de negocio nuevos

- [ ] **A-1** 🟥 *diseño primero* — **Comisiones de venta de punta a punta**:
  % de comisión por producto y por oferta, cálculo al facturar, 3 reportes
  (por venta/vendedor/producto). Hoy no existe ni el campo.
- [ ] **A-2** 🟥 *diseño primero* — **Motor de Ofertas ampliado**: agregar
  tipos BOGO ("Compra X Lleva Y", "Segunda Unidad"), tope de descuento
  máximo, vigencia con fecha+hora, control de acumulabilidad, prioridad
  entre ofertas simultáneas. Extiende `OfertasService` existente (Fase 4b),
  no es un módulo nuevo desde cero.
- [ ] **A-3** 🟥 *diseño primero* — **Lealtad / puntos / recompensas**:
  acumulación (por monto o unidad), canje, expiración opcional. Apple/Google
  Wallet queda fuera de un primer corte (requiere certificados de Apple/
  Google, no solo backend).
- [ ] **A-4** 🟥 *diseño primero, alcance grande* — **Tienda online**: Cuadre
  la resuelve con subdominio propio por tenant + Site Builder + pedidos +
  checkout. Esto es un producto nuevo completo, no una extensión — merece
  su propia conversación de alcance separada de todo lo demás en este
  documento (¿vale la pena para el negocio del usuario, o es una
  distracción de esfuerzo respecto a las demás brechas?).

## B — Fiscal y DGII

- [ ] **B-1** 🟧 — **Ampliar `TipoNcf`** a los 20 tipos observados: B11
  (Comprobante de Compras), B13 (Gastos Menores), B14 (Regímenes
  Especiales), B15 (Gubernamental), B16 (Exportaciones), B17 (Pagos al
  Exterior), y sus 6 equivalentes electrónicos E41/E43/E44/E45/E46/E47.
  Extiende el enum existente, no rompe nada.
- [ ] **B-2** 🟧 — **Secuencias de NCF por sucursal** (hoy `NcfAsignado` es
  por tenant) + **umbral de alerta** configurable ("quedan pocos
  comprobantes").
- [ ] **B-3** 🟨 — **Leyes Fiscales**: % del ITBIS a pagar por norma/sector
  (ej. construcción), catálogo simple que modifica el cálculo de
  `porcentajeItbis` en casos especiales.
- [ ] **B-4** 🟨 — **Recargos de Factura**: cargos post-subtotal
  (Imprevistos, Viáticos, etc.), % por defecto ajustable por factura, con
  o sin ITBIS propio.
- [ ] **B-5** 🟥 *diseño primero* — **e-CF real (firma y envío a la DGII)**:
  Cuadre integra un proveedor certificado ("Pascal ECF") en vez de construir
  el firmador propio — investigar si existe un proveedor equivalente
  comercial en RD antes de intentar certificarnos nosotros mismos como
  emisor (proceso de semanas, 15 pasos oficiales).
- [ ] **B-6** 🟧 — **Condición de pago con plazo explícito** (15/30/45/60/90
  días) con vencimiento auto-calculado en la factura, más allá de
  `CONTADO`/`CREDITO` binario.
- [ ] **B-7** 🟨 — **Toggle de ITBIS por línea** de factura, independiente
  del `porcentajeItbis` del producto.
- [ ] **B-8** 🟨 — **Descuento general de documento** (% o $) sobre el
  subtotal completo de la factura, separado del descuento por línea.
- [ ] **B-9** 🟨 — **Línea manual/libre en factura**, no ligada a un
  producto del catálogo (para casos de servicios sueltos).

## C — Pagos

- [ ] **C-1** 🟥 *diseño primero* — **AZUL y CARDNET**: link de pago +
  terminal física (Pin Pad) con Venta/Anulación/Devolución/Cierre de Lote.
  Más relevante para el mercado real que arreglar Stripe — evaluar antes
  si conviene priorizar esto por encima de C-2.
- [ ] **C-2** 🟧 — **Multi-moneda de punta a punta**: selector de moneda en
  cada cobro individual del POS y en movimientos de caja, catálogo de
  tasas de cambio de entrada manual. Depende de decidir si de verdad hace
  falta o si es sobre-ingeniería para un negocio que opera solo en DOP.

## D — Autorización de acciones sensibles

- [ ] **D-1** 🟧 *diseño primero* — **Capa 2 de autorización (opcional) por
  un segundo usuario real**: hoy nuestro PIN de Fase 9 es autoservicio (el
  mismo cajero se reconfirma). Evaluar agregar un modo opcional donde
  anulaciones/devoluciones grandes requieran que un supervisor (persona
  distinta) apruebe — vía email con código de un solo uso, sin
  necesariamente construir TOTP/Google Authenticator completo en un primer
  corte.

## E — Operación diaria / Inventario

- [ ] **E-1** 🟧 — **Patrón Borrador → Confirmado** en Compras, Ajustes y
  Transferencias: guardar como borrador editable antes de impactar
  stock/contabilidad, en vez del flujo inmediato actual.
- [x] **E-2** 🟨 — **Motivo de ajuste estructurado**: enum `MotivoAjusteInventario`
  (Merma / Robo-Pérdida / Daño / Vencimiento / Corrección de conteo / Otro),
  requerido en `AjustarStockDto`; el texto libre (`motivo`) pasó a opcional
  y ahora es solo detalle adicional — si se omite, se guarda la etiqueta
  legible del motivo elegido. Migración `20260821120000_motivos_estructurados`.
- [ ] **E-3** 🟨 — **Kardex agregado "todas las bodegas"**: hoy
  `GET /inventario/kardex/:varianteId` exige una `bodegaId` puntual.
- [ ] **E-4** 🟧 — **Alertas de inventario segmentadas**: 4 categorías (Sin
  Stock / Stock Bajo / Por Vencer 7 días / Vencidos) con dashboard propio,
  en vez de un solo contador.
- [ ] **E-5** 🟧 — **Cliente: campos nuevos** — categoría/segmentación,
  límite de crédito, comprobante fiscal por defecto (autoseleccionado en
  POS/Facturación), flag "cliente por defecto" (walk-in genérico).
- [ ] **E-6** 🟧 — **Cierres de caja como dashboard**: desglose de ventas
  por TODAS las formas de pago (no solo efectivo) en el resumen del cierre,
  estado "Pendiente revisión" para diferencias fuera de tolerancia.
- [ ] **E-7** 🟥 *diseño primero* — **"Caja" como entidad propia**:
  restricción de qué categorías/productos puede vender cada terminal
  física, independiente de Bodega/TurnoCaja.
- [ ] **E-8** 🟧 — **Producto: campos avanzados** — precio variable, unidad
  de medida real (kg/g/lb/oz/L/mL/gal/porción/docena), presentación de
  compra con conversión bulto→unidad, "es ingrediente", "permite
  devolución" por producto, códigos alternos múltiples. (OTP y "preguntas"
  quedan fuera — atados a Tienda Online, ver A-4.)
- [ ] **E-9** 🟨 — **Color por categoría "para POS"**: 12 swatches,
  pintura del grid de categorías en el punto de venta.
- [ ] **E-10** 🟨 — **Bonos en lote**: generar hasta 10,000 de una vez,
  fecha de expiración, tipo "uso único" vs. "gift card" (ya tenemos el
  equivalente a gift card).
- [ ] **E-11** 🟨 — **Formas de pago tipificadas**: clasificación de "tipo"
  (7 categorías) + "requiere referencia" configurable, más el concepto de
  "Crédito Cliente" (pagar contra cuenta corriente).

## F — POS

- [x] **F-1** ✅ *ya cubierto, no era una brecha real* — **Modal de descuento
  dedicado**: `ModalDescuento` en `TurnoCajaDetalle.tsx` ya tiene % o monto
  fijo, checkbox por línea del carrito + "seleccionar todos". Descubierto
  al empezar este ítem — se corrige la comparación original.
- [ ] **F-2** 🟨 — **Tipo de NCF integrado al selector de cliente**, con
  botón "Nuevo cliente" inline sin salir de la venta.
- [x] **F-3** ✅ *ya cubierto, no era una brecha real* — **Panel "Facturas de
  la sesión"**: la sección "Ventas del turno" en `TurnoCajaDetalle.tsx` ya
  lista todo lo vendido en el turno actual, inline, con imprimir/anular por
  fila. Diferencia menor con Cuadre: la de ellos es un panel aparte con
  buscador; la nuestra es una lista inline sin buscador — no vale la pena
  separar en un panel propio solo por eso.
- [ ] **F-4** 🟧 — **Canales de entrega del recibo**: email y WhatsApp
  además de imprimir (y "copiar", si aplica un link).
- [x] **F-5** 🟨 — **Movimiento de caja con motivo estructurado**: enum
  `MotivoMovimientoCaja` (Fondo de cambio / Depósito / Corrección / Otro),
  requerido en `CrearMovimientoCajaDto`; `concepto` (texto libre) pasó a
  opcional. Comprobante imprimible propio del movimiento queda fuera de
  este corte (no confirmado que sea necesario, se puede agregar después
  si se pide). Misma migración que E-2.
- [x] **F-6** ✅ *ya cubierto, no era una brecha real* — **Confirmación al
  retomar un carrito guardado**: `ModalGuardadas` ya tiene un botón
  "Recuperar" explícito por fila (no retoma con un solo click en la fila) —
  logra el mismo objetivo que el "Cargar este carrito" de Cuadre con un
  patrón distinto pero igual de seguro.
- [ ] **F-7** 🟨 — **Revisar cobertura de `useAtajosTeclado`** contra el set
  completo de 12 acciones de Cuadre (F2-F12, ⇧F12) — confirmar qué falta y
  hacer cada botón de acción visible con su atajo, no solo funcional.
- [ ] **F-8** 🟨 — **PWA instalable**: manifest + service worker básico
  para el POS.
- [ ] **F-9** 🟥 *diseño primero* — **Impresión local ESC/POS + apertura de
  gaveta**: agente descargable (Windows/Linux) — decisión de arquitectura
  grande, no un cambio de UI.

## G — RRHH

- [ ] **G-1** 🟧 — **Horarios como plantilla reutilizable**: definir un
  horario una vez y asignarlo a varios empleados, con flag "predeterminado
  para nuevos empleados" — hoy `HorarioEmpleado` es una fila por empleado
  sin plantilla.
- [ ] **G-2** 🟧 — **Tipos de Ausencia configurables por tenant**: máximo
  días/año, con/sin goce, requiere aprobación — hoy es un enum fijo en código.
- [ ] **G-3** 🟨 — **Aprobación de registros de asistencia** (Pendiente/
  Aprobado/Rechazado) — hoy solo calculamos tardanza sin flujo de aprobación.
- [ ] **G-4** 🟨 — **Umbral de horas extra + tolerancia de salida
  anticipada** configurables (además de la tolerancia de tardanza que ya
  tenemos).
- [ ] **G-5** 🟨 — **Calendario de feriados**: catálogo propio, "se repite
  cada año", relevante para nómina/asistencia.
- [ ] **G-6** 🟧 — **Deducciones de nómina configurables** (AFP/SFS tipo
  Porcentaje/Monto Fijo, distinción deducción-empleado vs. aporte-patronal)
  — **mantener el ISR calculado en código** (`isr.util.ts`), no
  reemplazarlo por un modo "escalonado" self-service a medias como el de
  Cuadre.
- [ ] **G-7** 🟨 — **Nómina filtrable por Puesto** + soporte de más de un
  tipo de período (Semanal/Quincenal/Bimensual, además de Mensual).
- [ ] **G-8** 🟨 — **Catálogo de "Puestos"** estructurado (separado de
  texto libre en Empleado), opcionalmente filtrado por tipo de negocio del tenant.
- [ ] **G-9** 🟥 *diseño primero, depende de hardware del cliente* —
  **Integración con relojes biométricos** (ANVIZ/CrossChex Cloud) — solo
  si algún cliente real lo pide, es una integración de hardware de terceros.

## H — Comunicación y plantillas

- [ ] **H-1** 🟧 — **Editor de plantillas de email** (HTML + variables tipo
  Handlebars), con los mismos eventos que ya notificamos (recibo, OTP,
  bienvenida, reset de password, recordatorio de crédito) — reemplaza las
  plantillas fijas en código de `EmailChannel`.
- [ ] **H-2** 🟥 *diseño primero, alcance grande* — **WhatsApp
  conversacional con IA**: bot que responde automáticamente a clientes
  (no solo notificaciones salientes). Evaluar si el asistente de IA interno
  ya construido se puede reusar como motor de respuestas.
- [ ] **H-3** 🟧 — **Plantillas de documentos personalizables** (factura/
  recibo) — evaluar si conviene un editor visual completo o alcanza con
  variables sobre las plantillas fijas actuales.

## I — Contabilidad

- [ ] **I-1** 🟥 *diseño primero* — **Cierre de período fiscal real**: hoy
  no existe (`docs/ARCHITECTURE.md` ya lo documenta, con la línea sintética
  "Resultado del Ejercicio" como solución temporal). Tocar esto con cuidado
  — tiene implicancias en todos los reportes contables.

## J — Varios / bajo esfuerzo

- [ ] **J-1** 🟨 — **Impresora de etiquetas ZPL/EPL**: generar el archivo en
  el protocolo nativo (Zebra/TSC/Godex/Eltron) para códigos de barra, sin
  necesitar agente local (a diferencia de F-9).
- [ ] **J-2** 🟨 — **Catálogo de reportes ampliado**: por vendedor, por
  código de barras alterno, de rentabilidad (margen real).
- [ ] **J-3** 🟨 — **"Mensaje a cajas"**: broadcast de un admin a las
  terminales POS activas (ej. "cerramos en 10 minutos").
- [ ] **J-4** 🟨 — **API keys con scopes granulares** (Leer/Escribir por
  recurso) — si en algún momento abrimos una API pública propia.

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

## Sugerencia de por dónde arrancar

No es obligatorio seguir este orden, pero si hay que elegir: los ítems 🟧/🟨
de las secciones **E** y **F** (operación diaria e inventario/POS) dan el
mejor esfuerzo/impacto — son extensiones de módulos que ya existen, sin
necesitar una conversación de alcance previa larga. Los 🟥 con "diseño
primero" conviene agruparlos en su propia sesión de planeamiento cuando se
prioricen, uno a la vez, siguiendo la misma mecánica que Sucursales (Fase 8)
y PIN (Fase 9): presentar el diseño, resolver casos límite, y recién
después ejecutar.
