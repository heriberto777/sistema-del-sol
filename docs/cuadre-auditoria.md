# Auditoría competitiva: Cuadre vs Sistema del Sol — investigación completa

Investigación en vivo (solo lectura, cuenta real del usuario, tenant "CIGUADR")
de las dos aplicaciones del competidor dominicano **Cuadre**:
`app.cuadre.do` (backoffice) y `pos.cuadre.do` (POS/caja). Cinco pasadas,
cada una corrida en solitario en su propia pestaña de navegador para no
repetir la interferencia de sesión que ocurrió cuando dos pasadas corrieron
en paralelo. Ver también el artefacto visual publicado en la conversación
("Radar Cuadre") con la versión condensada/priorizada de estos mismos
hallazgos — este documento es la fuente completa, sin resumir, para
tomar de acá al planear la integración.

## Índice

1. [Estructura del menú y hallazgos generales](#parte-1)
2. [Configuración y parámetros (Sistema → Configuración + Sistema)](#parte-2)
3. [Catálogo, Inventario, Ventas (Clientes/Cierres), Cobranza — formularios](#parte-3)
4. [RRHH, Contabilidad, Fiscal DGII, resto de Sistema](#parte-4)
5. [POS — pasada 1 (atajos, primeros flujos)](#parte-5)
6. [POS — pasada 2 (flujos confirmados con interacción real)](#parte-6)
7. [Sitio Web / Tienda Online, auditoría profunda](#parte-7)
8. [Facturación y Ventas, auditoría profunda + Alertas de Inventario](#parte-8)

---

<a id="parte-1"></a>
## Parte 1 — Estructura del menú y hallazgos generales (app.cuadre.do)

Alcance: solo lectura, sin crear/modificar/eliminar datos reales (ningún
formulario fue enviado con "Guardar" salvo apertura/cierre de modales de
inspección).

### Nota arquitectónica clave

Cuadre son en realidad **dos aplicaciones separadas** con login independiente:

1. **`app.cuadre.do`** — el backoffice/administración (lo que un dueño/gerente usa).
2. **`pos.cuadre.do`** — el POS de caja, standalone, con su propio login.

Dentro del backoffice, "Ventas" **NO es un acordeón que despliega páginas
internas** — es literalmente un link cross-domain que saca del backoffice y
lleva derecho a `pos.cuadre.do/pos` (el POS). El resto de "Inventario" (Stock,
Compras, etc.) sí vive en el backoffice. Cuadre trata "hacer una venta" como
una acción que siempre ocurre en la terminal de POS, nunca en el backoffice —
el backoffice solo consulta/gestiona lo ya vendido (Historial, Facturación de
servicios, Cierres de Caja, etc.).

### Estructura completa del menú (orden exacto observado)

**Dashboard** (solo, sin submenú — tabs internos: General | Ventas | Productos | Clientes | Objetivos | Proyecciones)

**Catálogo**
- Productos
- Atributos
- Categorías

**Inventario**
- Stock
- Proveedores
- Compras
- Ajustes
- Transferencias
- Kardex
- Alertas

**Ventas** *(el botón del grupo en sí redirige a pos.cuadre.do/pos)*
- Historial
- Cotizaciones
- Facturación
- Cierres de Caja
- Clientes
- Notas de Crédito
- Formas de Pago
- Cajas
- Bonos
- Ofertas

**Cobranza**
- Cuentas por Cobrar
- Registrar Cobro

**Sitio Web**
- Configuración
- Apariencia
- Site Builder
- Banners
- Páginas
- Pedidos
- Checkout

**Reportes**
- Centro de Reportes
- Cuadre de Caja

**Contabilidad**
- Plan de Cuentas
- Libro Diario
- Libro Mayor
- Balance Comprobación
- Estado Resultados
- Balance General
- Períodos Fiscales

**Fiscal DGII**
- e-CF Pendientes
- e-CF Mensajería
- Formato 606
- Formato 607
- Formato 608
- IT-1

**RRHH**
- Empleados
- Horarios
- Asistencia
- Ausencias
- Nómina
- Reportes
- Configuración HR

**Organización**
- Sucursales
- Bodegas
- Puestos
- Empleados *(nota: aparece TAMBIÉN aquí, además de en RRHH)*

**Sistema**
- Usuarios
- Comprobantes *(secuencias NCF)*
- Tarjetas *(proveedores de tarjeta/procesadores)*
- Tasas de Cambio
- Plantillas Email
- Plantillas Docs
- Biblioteca Medios
- Configuración *(hub con sub-secciones, ver Parte 2)*

### Detalle por sección — primera pasada

#### Catálogo → Productos

Lista: columnas Producto/Tipo/Categoría/Precio/Inv./Disponible/**Tienda Online**/Activo,
con toggles inline por fila, filtros por categoría, estado (Activos/Inactivos/**Descontinuados**),
checkboxes "Sin Existencia" y "Stock Bajo". Botones: Códigos de Barra (bulk), Exportar/Importar Excel.

**Formulario "Nuevo Producto"** — tabs: General | Precios | Descuentos |
**Comisiones** | Variantes | **Códigos Alt.** | Inventario | **Preguntas**.
Campos de la tab General:
- Imagen (upload), Precio, Costo, Margen % (auto-calculado)
- Nombre*, Tipo* (Producto/Servicio/Combo — igual que nosotros), Estado
  (Activo/Inactivo/**Descontinuado**)
- Código, SKU, Código de barras, Categoría, Proveedor, Descripción
- Toggles: Disponible en POS, **No disponible temporalmente**, Favorito,
  **Aplica para rewards**, **Requiere OTP**, **Precio variable**, **Permite devolución**
- Inventario y Costos: Controlar inventario, Control por lotes, Permitir
  decimales, **Es ingrediente**, **Unidad de medida** (Unidad/Kilogramo/Gramo/
  Libra/Onza/Litro/Mililitro/Galón/Porción/Docena), **Días alerta vencimiento**
  (por producto), **Presentación de compra** (Paquete/Caja/Bolsa/Bloque/
  Botella/Lata/Cartón/Contenedor/Rollo/Fardo/Paleta/Saco) + **Cantidad por presentación**

🆕 **GAP GRANDE**: tabs "Comisiones", "Códigos Alt." (múltiples), "Preguntas"
(Q&A para tienda online). Más: OTP requerido, precio variable, unidad de
medida real, presentación de compra con conversión bulto→unidad, días de
alerta de vencimiento configurables por producto, "es ingrediente", "permite
devolución" por producto.

✅ ya cubierto (diferencias: tipo Producto/Servicio/Combo, variantes,
categorías, proveedor, control de lotes/vencimiento — todo esto ya lo
tenemos, con menos granularidad en unidad de medida y sin comisiones/OTP/
precio variable/ingrediente).

#### Ventas → Historial

"Historial de Ventas" — filtros: Fecha desde/hasta, **Estado** (Todos/
Completadas/Canceladas/**Devueltas**/Pendientes/**Borrador**), Buscar orden,
Cliente, **Cajero** (separado de Vendedor), Vendedor.

✅ ya cubierto (diferencias: filtro explícito por Cajero Y Vendedor por
separado, estado "Borrador" para ventas aparcadas — nosotros lo llamamos
"venta aparcada" pero no aparece como filtro de estado en un listado unificado).

#### Ventas → Cotizaciones

Simple: "Nueva Cotización", buscar, filtros. ✅ cubierto, paridad aparente.

**Nota**: no existe ningún ítem de menú equivalente a "Remisiones" en TODO el
menú de Cuadre. Sugiere que Cuadre NO tiene el concepto de remisión/nota de
entrega como documento propio separado de la factura — algo que NOSOTROS SÍ
tenemos y ellos aparentemente no.

🆕 **Confirmado en vivo (Parte 8, 2026-08-26), a pedido del usuario**: una
Cotización de Cuadre **nunca se convierte en Factura** — ni en la lista de
acciones (Ver/Imprimir/Descargar/Ver detalle/Enviar/Editar), ni en el panel
de detalle, ni en el editor completo (que termina en "Condiciones
Comerciales" — Forma de Pago/Tiempo de Entrega/Garantía, todo texto libre,
sin ningún botón de conversión). Es un documento de punta muerta: se
imprime, se envía por correo, y ahí termina su ciclo de vida — el cajero
tiene que rehacer manualmente la venta en Facturación o el POS si el
cliente acepta. **Nosotros SÍ convertimos** (`FacturacionService.crear()`
reusado desde Cotizaciones/Remisiones, ver CLAUDE.md — sin duplicar NCF/
ITBIS/stock) — ventaja real y más grande de lo que este documento
reflejaba antes (el "no existe Remisiones" ya estaba anotado, pero no que
ademas Cotizaciones tampoco convierte).

#### Ventas → Facturación (`/invoices`, `/invoices/new`)

"Gestiona tus facturas de **servicios**" — subtítulo sugiere que este módulo
es para facturación tipo B2B/servicios, separado de las ventas de POS (que
van a "Historial").

**Formulario "Nueva Factura"**:
- Cliente* (F3), Fecha
- **Condición de Pago**: Contado / 15 / 30 / 45 / 60 / 90 Días — con
  "Vencimiento" auto-calculado y deshabilitado según la condición elegida
- **Tipo de NCF**: B01 / B02 / **B14 Regímenes Especiales** / **B15
  Gubernamental** — seleccionable LIBREMENTE por el usuario en cada factura
- Notas (texto libre)
- Líneas: F4 busca productos (multi-selección), **F6 agrega una línea
  MANUAL/libre** (no ligada a ningún producto) — con columnas #, Descripción
  (texto libre), Cant, Precio, Desc %, **ITBIS (checkbox por línea)**, Subtotal
- **Descuento General**: selector % o $ aplicado sobre el subtotal de TODAS
  las líneas (además de cualquier descuento por línea)

🆕 **GAP GRANDE**:
1. Tipos de NCF **B14/B15** — no existen en nuestro `NCF_POR_TIPO`/`TipoNcf`.
2. **Condición de pago con plazo explícito en días** con vencimiento
   auto-calculado en la factura — nosotros solo tenemos `CONTADO`/`CREDITO`
   binario sin un plazo capturado en la factura.
3. **Línea manual/libre no ligada a un producto del catálogo** — imposible
   hoy (`LineaFacturaDto.productoId` es obligatorio y debe existir).
4. **Toggle de ITBIS por línea** — nosotros calculamos ITBIS siempre desde
   `producto.porcentajeItbis`.
5. **Descuento general de documento (% o $)** separado del descuento por
   línea.

#### Ventas → Notas de Crédito

Lista con filtros: Cliente, **Estado** (Todos/**Activa**/**Parcial**/**Usada**/Cancelada), rango de fechas.

🆕 **GAP GRANDE**: los estados Activa/Parcial/Usada revelan que en Cuadre una
Nota de Crédito es un **saldo de crédito redimible** que el cliente puede
aplicar (total o parcialmente) a compras FUTURAS — no una reversión inmediata
1:1 de una factura específica. Se confirma en Formas de Pago: "Nota de
Crédito" es literalmente una de las formas de pago disponibles al cobrar una
venta/factura futura (y también en Registrar Cobro y en el checkout del
POS). En nuestro sistema, una Nota de Crédito reintegra stock/monto contra la
factura de origen en el momento — no existe el concepto de "saldo de NC
pendiente de usar" que se aplique como medio de pago en una venta posterior.

#### Ventas → Formas de Pago

Catálogo con 5 filas sembradas: Efectivo (EFE), Tarjeta (TAR), Transferencia
(TRF), Crédito Cliente (CRE), Cheque (CHE), Nota de Crédito (NC). Columnas:
Código, Nombre, **Tipo**, **Requiere Ref.** (Sí/No), switch Estado, Editar/Eliminar.

**Formulario "Nueva Forma de Pago"**: Código*, **Orden**, Nombre*,
**Tipo*** (radio: Efectivo/Tarjeta/Transferencia/Crédito/**Bono-Voucher**/
**Nota de Crédito**/Cheque), **Requiere referencia** (toggle), **Activo** (toggle).

🆕 **GAP MEDIO**: catálogo de formas de pago totalmente gestionable con
clasificación estructurada en 7 "tipos", orden de despliegue configurable, y
toggle "requiere referencia" por forma de pago. Nosotros tenemos
`esBono`/`esEfectivo` como flags puntuales, no una clasificación completa.
"Crédito Cliente" (pagar con el balance de cuenta corriente del cliente) es
otro concepto que no tenemos explícito.

#### Ventas → Cajas (tabs: Cajas | Print Service)

Lista de Cajas: columnas CAJA, **CATEGORÍAS** (restricción de qué categorías
puede vender esa caja), **PRODUCTOS** (restricción de qué productos),
**FAVORITOS**, **IMPRESIÓN** (método por caja), **ACTIVA**.

**"Nueva Caja"**: Código*, Nombre*, Caja activa.

**Tab "Print Service"**: descarga/instalación de un **servicio de impresión
local** (Windows .zip / Linux .tar.gz) que corre como background service en
la computadora del negocio, permitiendo:
- Impresión ESC/POS DIRECTA a impresoras térmicas (sin diálogo del navegador)
- **Apertura de gaveta de dinero (cash drawer) por COM/serial**
- En Linux usa CUPS + Node.js; en Windows es un .exe standalone

🆕 **GAP MUY GRANDE (top prioridad)**: "Caja" es una entidad de configuración
propia e independiente de Bodega/TurnoCaja, con restricción de
categorías/productos vendibles por terminal y favoritos por terminal. Y el
**servicio de impresión local con ESC/POS crudo + apertura de gaveta de
dinero es EXACTAMENTE la limitación que ya tenemos documentada y aceptada en
`docs/ARCHITECTURE.md`** ("diálogo de impresión del navegador — sin ESC/POS
crudo ni agente local").

#### Ventas → Bonos

Lista: "Nuevo Lote" (los bonos se generan en LOTES).

**Formulario "Nuevo Lote de Bonos"**:
- **Tipo de bono***: "Uso único" vs. **"Gift Card"** (uso múltiple hasta agotar saldo)
- Valor de cada bono*, **Cantidad de bonos*** (1 a 10,000)
- Descripción, **Cliente asociado (opcional)**, **Tiene fecha de expiración** (checkbox)

🆕 **GAP GRANDE**: generación en LOTE (hasta 10,000), dos tipos de bono,
**fecha de expiración** (no tenemos expiración en Bonos), y asociación
opcional a un cliente específico.

#### Ventas → Ofertas

Lista con filtro de Estado: Todos/Activas/**Programadas**/Expiradas/Inactivas.

**Formulario "Nueva Oferta"**:
- Código*, Nombre*, Descripción
- **Tipo de Oferta*** (5 tipos): Descuento Porcentual / Descuento Fijo /
  **Compra X Lleva Y** (2x1, 3x2, etc.) / **Segunda Unidad** (con descuento) /
  **Compra Mínima**
- **Descuento máximo (opcional)** — tope en $
- **Vigencia**: Fecha/Hora Inicio* Y Fecha/Hora Fin* (fecha+HORA)
- Productos y Categorías aplicables (subcategorías se incluyen automático)
- **Activa**, **Acumulable**, **Paga comisión**, **Prioridad**

🆕 **GAP MUY GRANDE**: motor de ofertas mucho más sofisticado. Nosotros (Fase
4b) solo tenemos descuento automático por producto+categoría+carrito, "no
acumulable" fijo. Cuadre tiene 5 tipos configurables (incluyendo BOGO real),
tope de descuento máximo, ventana de vigencia con hora exacta, control
explícito de "acumulable", prioridad configurable, y el flag "paga comisión"
que conecta con un sistema de comisiones de venta que **nosotros no tenemos
en absoluto**.

#### Sitio Web — 🆕 GAP ENORME, MÓDULO COMPLETO INEXISTENTE

Sub-secciones: Configuración, Apariencia, **Site Builder**, Banners, Páginas, Pedidos, Checkout.

Cada tenant obtiene una tienda online en su propio subdominio
(`{subdominio}.cuadre.do` — confirmado real, `ciguadr.cuadre.do`, con link
"Ver Tienda"). Toggle "Tienda en Línea". Campos: Nombre de la Tienda,
Subdominio, Descripción, Email de Contacto, Teléfono, Dirección.

🆕 **GAP #1 EN TAMAÑO**: Cuadre no es solo un sistema de facturación/POS — es
también una **plataforma de e-commerce completa integrada** (constructor de
sitio visual, gestión de banners/páginas, pedidos online separados del POS,
checkout/pasarela para la tienda, subdominio propio por tenant). Nosotros no
tenemos NADA de tienda online.

#### Reportes → Centro de Reportes

Catálogo categorizado:

**Ventas** (10 reportes): Resumida, Detallada, por Fecha, por Cliente, por
Categoría, por Producto, **por Código Alterno**, por Tipo de Pago, **por
Vendedor**, **Rentabilidad**.

**Comisiones** (3 reportes): por Venta, por Vendedor, por Producto.

🆕 **GAP GRANDE**: catálogo mucho más amplio y granular que nuestro Dashboard
+ Reporte de Inventario. Los 3 reportes de comisiones confirman un módulo de
comisiones de venta de punta a punta que nosotros no tenemos en absoluto.

#### Contabilidad, Fiscal DGII, RRHH, Organización (vista general, primera pasada)

**Contabilidad**: Plan de Cuentas, Libro Diario, Libro Mayor, Balance de
Comprobación, Estado de Resultados, Balance General, Períodos Fiscales —
mismo set conceptual que nuestra Contabilidad.

**Fiscal DGII**: e-CF Pendientes, e-CF Mensajería, Formato 606/607/608, IT-1.

🆕 **GAP GRANDE (limitación ya documentada nuestra)**: "e-CF Pendientes"
(cola por enviar) y "e-CF Mensajería" (log de mensajes con la DGII) sugieren
que Cuadre implementa el envío/firma real de e-CF a la DGII. Nuestro
`docs/ARCHITECTURE.md` ya documenta "e-NCF propio: esta fase solo cubre la
numeración, no la firma/envío".

**RRHH**: Empleados, Horarios, Asistencia, Ausencias, Nómina, Reportes,
Configuración HR — coincide con nuestras Fases 7a-7d (ver Parte 4 para el
detalle profundo).

**Organización**: Sucursales, Bodegas, **Puestos**, Empleados. 🆕 "Puestos"
como catálogo propio de cargos, separado de Empleados.

#### Sistema (vista general, primera pasada)

Usuarios, Comprobantes (✅ equivalente a `NcfAsignado`), **Tarjetas**, **Tasas
de Cambio**, Plantillas Email (✅ cubierto), **Plantillas Docs**, Biblioteca
Medios, Configuración (ver Parte 2 para el detalle).

🆕 **Tarjetas** (`/card-providers`): procesadores/marcas de tarjeta.

🆕 **Tasas de Cambio** (`/currency-rates`): soporte multi-moneda con tasas
gestionables — nuestro sistema es mono-moneda (DOP).

🆕 **Plantillas Docs**: plantillas personalizables de documentos.

### Resumen priorizado — Parte 1

1. Módulo de tienda online / e-commerce completo — un producto entero.
2. Sistema de Comisiones de venta de punta a punta.
3. Motor de Ofertas mucho más sofisticado (BOGO, tope, vigencia por hora, prioridad).
4. Servicio de impresión local (ESC/POS) + apertura de gaveta — limitación ya conocida.
5. e-CF real (firma y envío a la DGII) — limitación ya conocida.
6. Sistema de Lealtad/Puntos/Recompensas.
7. Notas de Crédito como saldo redimible.
8. Multi-moneda.
9. "Caja" como entidad de configuración propia.
10. Producto: campos avanzados.

**Lo que NOSOTROS tenemos y Cuadre aparentemente NO**: Remisiones/notas de entrega.

### Limitaciones de esta primera pasada

- Se priorizó amplitud (cubrir el 100% de la estructura del menú) sobre
  profundidad en cada formulario — resuelto en las Partes 2-4.
- No se pudo interactuar de forma confiable con F7/F9 del POS vía
  automatización — resuelto en la Parte 6.

---

<a id="parte-2"></a>
## Parte 2 — Configuración y parámetros (Sistema → Configuración + Sistema)

Segunda pasada, solo lectura (ningún "Guardar" real presionado en
configuración de negocio). Corrida en solitario, sin interferencia.

### Negocio (`/settings/business`)

- Nombre del negocio*, Tipo de negocio (Tienda/Retail, Restaurante,
  Farmacia, Supermercado/Abarrotes, Otro), RNC/NIT/RFC, Teléfono, Email,
  Sitio web, Dirección.
- Logo + Icono de empresa (upload, usados en menú lateral, login, y apps POS).
- Moneda base (DOP/USD/MXN/COP/EUR), Zona horaria (6 opciones), País
  (RD/Panamá/EE.UU. — "se usa para generar los impuestos predeterminados del país").

### Impuestos (`/settings/taxes`) — más rico de lo esperado

- Toggle global "Los precios ya incluyen impuestos".
- Tabla de impuestos editable: Nombre, Código, Tasa%, flag "Primario"
  (extrae precio base cuando el precio incluye impuesto), flag "Por
  Defecto", Estado. "Nuevo Impuesto": Código*, Nombre*, Tasa%*, Impuesto
  Primario (switch), Por Defecto (switch).
- **🆕 Leyes Fiscales** — reglas que MODIFICAN el cálculo del ITBIS para
  casos especiales (ejemplo: Norma 07-2007 para construcción). "Nueva Ley":
  Código*, Nombre*, **"% del ITBIS a Pagar"*** (ej. 10 = solo se paga 10% del
  ITBIS normal: 18%→1.8% efectivo), Descripción. Mecanismo real de
  exención/reducción parcial de ITBIS por sector — no tenemos nada
  equivalente (nuestro `porcentajeItbis` es fijo por producto).
- **🆕 Recargos de Factura** — cargos que se aplican DESPUÉS del subtotal
  (ejemplos: Imprevistos, Viáticos, Diseño y Supervisión — típico de
  facturación de servicios/construcción). "Nuevo Recargo": Nombre*, "% Por
  Defecto"* (ajustable por factura), "Gravado con ITBIS" (switch), Orden,
  Descripción. No tenemos ningún concepto de recargo post-subtotal
  configurable.

### Métodos de Pago (`/settings/payment-methods`)

Cargó vacío en esta pasada (probablemente la misma pantalla que "Ventas →
Formas de Pago", ya documentada arriba).

### POS (`/settings/pos`) — la sección más importante para el usuario

**Numeración de Documentos**: Prefijo de órdenes (ej. "ORD"), Prefijo de
facturas (ej. "FAC") — prefijos de texto para IDs internos de orden/factura,
NO relacionados con el NCF (eso vive en "Comprobantes").

**Reglas de Venta**:
- "Requerir cliente para venta" (checkbox, off por defecto).
- "Requerir cliente para crédito" (checkbox, **on** por defecto).
- "Permitir pagos parciales" (checkbox, **on**).

**Descuentos**:
- "Permitir descuentos" (checkbox, on).
- "Descuento máximo permitido (%)" — spinbutton 0-100, hoy en 100 (sin tope real).
- "Requerir autorización para aplicar descuentos" (checkbox, **off** por defecto).

**🆕 Autorizaciones — el hallazgo clave**:
- "Requerir autorización para anular" (checkbox, **on**).
- "Requerir autorización para devoluciones" (checkbox, **on**).
- **"Método de autorización"** (radio, uno global para todo el tenant):
  1. **"Correo electrónico"** (por defecto) — "Se envía un código por email al supervisor".
  2. **"Google Authenticator"** — "El supervisor ingresa el código de su app" (TOTP).

**Importante para comparar con nuestro PIN de Fase 9**: esto NO es un PIN
simple que el usuario recuerda y escribe — es un código de un solo uso
enviado por EMAIL al supervisor, o un código TOTP de una app de
autenticación que el supervisor configura en su perfil de usuario. La
autorización la da un SUPERVISOR (persona distinta, con su propio factor de
verificación), no el mismo cajero confirmando su propia identidad con un PIN
memorizado. Nuestro modelo (PIN propio, autoservicio) es más simple/rápido
para el cajero, pero menos seguro en el sentido de "cualquiera que sepa el
PIN robado puede autorizar sin que un tercero lo apruebe realmente" — el de
Cuadre exige que un supervisor real intervenga.

No hay reglas de autorización por MONTO ni por ROL específico más allá de
"requerir autorización sí/no" por tipo de acción — es más simple de lo que
el nombre de la sección sugería.

También separado: cada usuario individual puede tener su propio "PIN (4-6
dígitos)" asignado por el ADMINISTRADOR al crearlo/editarlo — pero eso no se
usa en las Autorizaciones (que usan email/TOTP). Ver Parte 4: el PIN de
empleado sirve para asistencia + login al POS, no para autorizaciones.

### Recibos (`/settings/receipts`)

Encabezado del recibo (texto libre, 500 car.), Pie del recibo (500 car.),
"Mostrar logo en el recibo" (switch, on), "Imprimir recibo automáticamente
al completar venta" (switch, off). Simple.

### Fiscal (`/settings/fiscal`) — dos tabs: Configuración y Certificación DGII

**Configuración**: dos switches — "Habilitar comprobantes fiscales" (NCF) y
**"Habilitar Pascal ECF"** ("Conecta tu sistema POS con Pascal ECF para
emitir comprobantes fiscales electrónicos validados por la DGII").

🆕🆕 **Hallazgo clave — Cuadre NO construyó su propio firmador/emisor
e-CF; integra un proveedor certificado externo llamado "Pascal ECF"**
(dominio visto en la config de WhatsApp: `pascalapi-production.up.railway.app`,
sugiere que "Pascal" es un servicio/API propio del mismo equipo de Cuadre,
no un tercero — probablemente un microservicio separado dedicado a e-CF que
reutilizan). No hace falta construir la certificación DGII desde cero como
un monolito — se puede aislar como un servicio propio.

🆕🆕🆕 **Tab "Certificación DGII" — wizard COMPLETO de los 15 pasos
oficiales de certificación como emisor e-CF ante la DGII**:
- Contador "0/15 pasos completados".
- Pre-requisito obligatorio "Datos del Emisor": Nombre del Negocio/Razón
  Social*, RNC*, Dirección*, Teléfono*, Correo Electrónico*.
- **15 pasos**:
  1. (Portal DGII) Registro en DGII.
  2. (Automatizado) "Pruebas de Datos e-CF" — envía 21 facturas e-CF de
     prueba + 4 facturas RFCE de consumo <250k; descarga 4 XML de E32 para
     subir al portal DGII; upload de "Excel de comprobantes (DGII)".
  3. (Automatizado) Aprobaciones Comerciales.
  4. (Automatizado) Simulación e-CF.
  5. (Mixto) Simulación Representación Impresa.
  6. (Portal DGII) Validación Representación Impresa.
  7. (Portal DGII) URLs Servicios Prueba.
  8. (Portal DGII) Inicio Prueba Recepción e-CF.
  9. (Mixto) Recepción e-CF.
  10. (Portal DGII) Inicio Prueba Aprobación Comercial.
  11. (Mixto) Recepción Aprobación Comercial.
  12. (Portal DGII) URLs Servicios Producción.
  13. (Mixto) Declaración Jurada.
  14. (Portal DGII) Verificación Estatus.
  15. (Portal DGII) Finalizado.
- Link directo "Abrir portal DGII" → `https://ecf.dgii.gov.do/`.

Emitir e-CF real en RD no es solo "firmar y enviar" — es un proceso de
certificación de semanas con 15 hitos oficiales. Replicar esto no es solo
"conectar una librería de firma" — es un producto de certificación en sí mismo.

### Lealtad (`/settings/rewards` — slug real, no `/settings/loyalty`)

Con el programa DESACTIVADO por defecto, solo un switch + zona de peligro
"Resetear todos los puntos". Al activar aparecen:

- **Acumulación de Puntos**: Modo (Por monto / Por unidad), "Monto por
  punto", "Calcular sobre" (Subtotal / Total), "Items con descuento generan
  puntos" (switch).
- **Canje de Puntos**: "Valor del punto", "Mínimo para canjear".
- **Expiración**: "Días de expiración" (vacío = no expiran).
- **Tarjeta Wallet**: switch para Apple Wallet / Google Wallet.

Motor de puntos plano (sin niveles/tiers) pero completo, con integración a
wallets nativos del teléfono.

### Inventario (`/settings/inventory`)

"Permitir stock negativo" (checkbox, off), "Alertas de stock bajo"
(checkbox, on), "Días de anticipación para alertas de vencimiento"
(spinbutton, default 30). Mismo nivel conceptual que lo que ya tenemos.

### Impresora de Códigos (`/settings/barcode`)

Con "Usar impresora de etiquetas" activado:
- **Formato**: HTML/PDF (normal) / **ZPL** (Zebra, TSC, Godex) / **EPL** (Zebra legacy, Eltron).
- **Resolución (DPI)**: 203 / 300 / 600.
- **Ancho/Alto de etiqueta (mm)** (default 50×25).
- **Oscuridad de impresión** (0-30 ZPL, 0-15 EPL).
- **Rotación**: 0°/90°/180°/270°.
- Impresoras compatibles: Zebra GK420/GX420/ZD420, TSC TE200/TE300, Godex
  G500/EZ-2050 (ZPL); Zebra LP2844, Eltron LP2442 (EPL).

Soporte real de hardware de impresión de etiquetas industrial — genera el
archivo en el protocolo nativo de la impresora. No tenemos nada equivalente.

### WhatsApp (`/settings/whatsapp`)

- **Config. Twilio**: Account SID*, Auth Token*, Número WhatsApp*, URL del
  Webhook (`https://pascalapi-production.up.railway.app/api/webhooks/twilio/whatsapp`),
  Número para prueba, botón "Probar Twilio".
- **Proveedor de IA**: selector Claude / OpenAI / Vercel AI, Modelo, "Historial de
  Conversación" (0-50 mensajes), API Key, botón "Probar IA".
- **Números Permitidos**: lista blanca.
- **Historial de Mensajes**: dashboard con "Mensajes hoy", "Tokens
  consumidos", "Mensajes fallidos".

Es un **bot de WhatsApp con IA generativa que responde automáticamente a los
clientes** (no solo un canal de notificaciones salientes como el nuestro).

### API & MCP (`/settings/api-keys`)

"Nueva Clave API": Nombre*, permisos GRANULARES por recurso con checkboxes
Leer/Escribir: Productos, Ventas, Clientes, Inventario, Reportes (**solo
Leer**), Facturación, **"Links de Pago"**. Expiración: Nunca / 30 / 60 / 90
días / 1 año.

Sistema de scopes de API key tipo OAuth — más fino que "todo o nada".

### 🆕🆕🆕 Tarjetas / Proveedores de Tarjeta (`/card-providers`) — más importante que "multi-moneda"

Integraciones reales con los dos procesadores dominantes del mercado dominicano:

1. **AZUL Payment Link**: links de pago vía WhatsApp/email/SMS. Venta, Link
   de Pago, Cuotas. `developer.azul.com.do/docs/payment-link`.
2. **AZUL Veriphone (Pin Pad)**: terminal física. Venta, Anulación,
   Devolución, Cierre de Lote, Cuotas. `developer.azul.com.do/docs/veriphone`.
3. **CARDNET Botón de Pago**: botón web / links de pago. `developer.cardnet.com.do/docs/boton-pago`.
4. **CARDNET (Pin Pad)**: terminal física. Venta, Anulación, Devolución,
   Cierre de Lote. `developer.cardnet.com.do/docs`.

Formulario "Configurar Proveedor" (genérico, reutilizado por proveedor):
- **Credenciales**: Merchant ID*, URL del API*, API Key*, Secret Key*, URL de Callback.
- **Configuración**: Activo, "Proveedor predeterminado", "Modo de
  prueba/Sandbox", "Captura automática" (capturar al autorizar vs. dos pasos).
- **Límites (Opcional)**: Monto mínimo, Monto máximo.
- **Comisiones (Para tracking)**: Comisión % y Comisión fija — solo registro
  interno, no afecta el cobro real.

Nuestra integración de pagos hoy es Stripe cobrando en USD sin conversión —
genérica, no pensada para RD. AZUL y CARDNET son las pasarelas/procesadores
REALES que usan los comercios dominicanos.

### Tasas de Cambio (`/currency-rates`)

Entrada manual únicamente, sin feed automático. "Nueva Tasa de Cambio":
selector de Moneda (12: EUR, MXN, COP, ARS, CLP, PEN, BRL, GBP, CAD, CHF,
JPY, CNY), campo "1 DOP = X [moneda]", sin fecha de vigencia futura (tasa
vigente ahora, timestamp de última actualización). Se puede "Eliminar".

### Comprobantes / Secuencias Fiscales (`/fiscal-sequences`)

Tabla: SECUENCIA, **SUCURSAL** (¡las secuencias se pueden asignar por
sucursal específica!), RANGO, USO, PRÓXIMO NCF, ESTADO, VENCIMIENTO, +
acciones Ver historial / Editar / Desactivar / Eliminar.

Sembradas en esta cuenta: B01 (1-500), B02 (1-1,000), B04 (1-100) — todas
"Todas las sucursales", "Por defecto", vencen 18/8/2027.

"Nueva Secuencia Fiscal": Nombre*, **Tipo de Comprobante*** con **20 tipos**
(nosotros solo soportamos 4):
- Papel: B01, B02, B03, B04, **B11 Comprobante de Compras, B13 Gastos
  Menores, B14 Regímenes Especiales, B15 Gubernamental, B16 Exportaciones,
  B17 Pagos al Exterior**.
- Electrónico: E31-E34 (equivalentes B01-B04), **E41 Compras Electrónico,
  E43 Gastos Menores Electrónico, E44 Regímenes Especiales Electrónico, E45
  Gubernamental Electrónico, E46 Exportaciones Electrónico, E47 Pagos al
  Exterior Electrónico**.
- Sucursal* (Todas / Sucursal Principal), Prefijo*, Serie*, Rango
  Inicial*/Final*.
- Fecha de Autorización, Fecha de Vencimiento.
- **"Umbral de Alerta"** (spinbutton, default 50) — "Se mostrará alerta
  cuando queden menos de este número de comprobantes".
- "Secuencia por defecto" (switch, por tipo), Notas.

🆕 **Gaps concretos y accionables**: (1) soportamos solo 4 de 20 tipos de
NCF/e-CF; (2) nuestras secuencias son por tenant, no por sucursal; (3) no
tenemos umbral de alerta configurable; (4) no tenemos fecha de
autorización/vencimiento en la secuencia misma.

### Usuarios (`/users`) — nuestro RBAC es MÁS sofisticado que el de ellos

Tabla: Usuario, **Rol**, **Sucursales** (columna con botón de asignar, ej.
"Todas (Admin)"), Activo, Creado, Editar/Eliminar.

"Nuevo Usuario": foto, Usuario* (`usuario@ciguadr`), Nombre completo*, Email
(opcional), Teléfono, Contraseña*, **"PIN (4-6 dígitos)"** (opcional,
asignado por el ADMIN, no autoservicio), **Rol*** — pero el desplegable
tiene solo **4 opciones fijas: Propietario, Administrador, Gerente,
Usuario**. NO hay editor de permisos granulares por acción/módulo.

En "Editar Usuario": sección **"Google Authenticator"** con botón
"Configurar" — "Active Google Authenticator para autorizar operaciones en
el POS sin necesidad de correo electrónico" — esto alimenta el método TOTP
de Configuración → POS → Autorizaciones.

**Reverse-gap confirmado**: nuestro sistema de roles/permisos personalizados
es objetivamente más flexible que los 4 roles fijos de Cuadre.

### Plantillas de Documentos (`/settings/document-templates`)

"Diseña tus facturas y recibos con el editor visual" — confirma que es un
EDITOR VISUAL. Filtros: Todos / Recibos / Facturas. Plantillas presentes:
"Factura Formal (A4)" y "Recibo Estándar (80mm)". Botón "Nuevo Recibo". No
se abrió el editor en sí (alcance exacto — ¿drag-and-drop? ¿solo
texto+variables? — sin confirmar).

### No explorado en la Parte 2

Editor visual de Plantillas Docs en sí, Plantillas Email (detalle — resuelto
en Parte 4), Biblioteca Medios, Apariencia y Mi Cuenta, Soporte (tickets),
flujo completo de asignación de sucursales desde la tabla de Usuarios.

### Resumen de hallazgos de configuración (prioridad)

1. **Autorización de POS por supervisor vía email/TOTP, no PIN** — más
   robusto que nuestro PIN de autoservicio (interviene un tercero real) pero
   más lento/pesado operativamente. Recomendación: mantener el PIN (rápido)
   como capa 1, y considerar un modo opcional "requerir un segundo usuario
   con permiso de supervisor" como capa 2 para anulaciones/devoluciones
   grandes, sin necesariamente construir email/TOTP completo.
2. **AZUL y CARDNET** — más relevante para el mercado real que arreglar
   Stripe/multi-moneda.
3. **Certificación e-CF como producto en sí mismo**.
4. **20 tipos de NCF/e-CF vs nuestros 4** — gap concreto y acotado.
5. **Secuencias de NCF por sucursal + umbral de alerta**.
6. **Leyes Fiscales y Recargos de Factura** — gaps nuevos, relevantes para
   negocios de servicios/construcción.
7. **Lealtad**: motor completo pero desactivado por defecto — feature real
   de adopción opcional.
8. **WhatsApp con bot de IA generativa entrante**.
9. **Impresora de etiquetas ZPL/EPL** — gap concreto y acotado.
10. **Reverse-gap confirmado**: nuestro RBAC de permisos personalizados es
    más sofisticado que los 4 roles fijos de Cuadre.

---

<a id="parte-3"></a>
## Parte 3 — Catálogo, Inventario, Ventas (Clientes/Cierres), Cobranza — formularios

Tercera pasada, solo lectura, corrida en solitario, ningún dato real
creado/guardado.

### Catálogo → Atributos (`/product-attributes`)

"Nuevo Atributo": Nombre*, Código*, **Tipo de entrada** (Lista desplegable /
Texto libre / Selector de color), Orden, Activo. Si es lista desplegable,
sección "Opciones" con Valor + Etiqueta + Activo por opción.

🆕 Gap: tipo de entrada estructurado (lista/texto/color) con opciones
Valor+Etiqueta separadas.

### Catálogo → Categorías (`/categories`)

"Nueva Categoría": Nombre*, Descripción, **Categoría Padre** (jerarquía),
Orden, **Icono** (picker), **Imagen** (upload, JPG/PNG/WebP máx. 5MB),
**Color (para POS)** — 12 swatches (Gris/Morado/Azul/Verde/Rosa/Ámbar/
Naranja/Turquesa/Índigo/Rojo/Cian/Rosado), Categoría activa.

🆕 Gap: color propio por categoría específicamente "para POS" — el grid de
categorías del POS se pinta con el color de cada una para escaneo visual
rápido del cajero.

### Inventario → Proveedores (`/suppliers`)

"Nuevo Proveedor": Código*, RNC/Cédula, Nombre*, Nombre de Contacto,
Teléfono, Email, Ciudad, Dirección, Notas, Proveedor activo. Simple — sin
términos de pago ni límite de crédito. ✅ probablemente ya cubierto igual o
mejor.

### Inventario → Compras (`/purchases`, `/purchases/new`)

Lista con filtro de estado: Todos / **Borradores** / **Confirmados** / Cancelados.

🆕 **Gap de flujo (patrón repetido en Compras/Ajustes/Transferencias)**:
Cuadre trabaja con un ciclo **Borrador → Confirmado** — se guarda una orden
como borrador editable y recién se "confirma" para que impacte
inventario/contabilidad. Nuestro `ComprasService` es más directo (crear OC,
luego `recibir()` mueve stock inmediatamente) — no hay un estado de borrador
intermedio editable antes de confirmar/mover stock.

"Nueva Compra": Proveedor (dropdown), **Bodega Destino*** (una sola bodega
para toda la orden), Fecha, Referencia (Factura), Notas. Líneas via
"Agregar Producto" → buscador con costo mostrado inline → cantidad → se
agrega con columnas: Producto, Cantidad, Costo Unit. (editable), Subtotal,
**Lote**, **Vencimiento**.

🆕 Gap notable: no se vio columna de ITBIS/impuesto por línea ni descuento
por línea en la orden de compra — el subtotal es solo cantidad×costo.

### Inventario → Ajustes (`/adjustments`, `/adjustments/new`)

Mismo patrón Borrador/Confirmado/Cancelado.

"Nuevo Ajuste": **Bodega*** (una sola), **Motivo*** — dropdown ESTRUCTURADO:
Merma / Robo-Pérdida / Daño / Vencimiento / Corrección de conteo / Otro
(default). Fecha, contador en vivo de unidades "+"/"-" agregadas,
Notas/Observaciones, líneas de producto con cantidad (positiva=entrada,
negativa=salida). Nota explícita: "Cantidad positiva: Entrada (encontramos
más de lo esperado)" / "Cantidad negativa: Salida (faltante, merma, daño)".

🆕 **Gap concreto y fácil de adoptar**: nuestro `motivo` en
`AjustarStockDto` es texto libre — Cuadre usa un dropdown de motivos
estructurados, lo cual permite reportar/filtrar ajustes por causa real
(útil para detectar patrones de merma o robo). Fácil de agregar como un enum
opcional sin romper compatibilidad.

### Inventario → Transferencias (`/transfers`, `/transfers/new`)

Mismo patrón Borrador/Confirmado/Cancelado. "Nueva Transferencia": Fecha,
**Bodega Origen***, **Bodega Destino*** (dropdowns independientes, sin
cross-check visible de sucursal en el formulario mismo — no se pudo
confirmar validación de sucursal por tener solo 1 bodega sembrada en esta
cuenta), Notas, líneas de producto con cantidad, contador de "Total de
productos" / "unidades totales". ✅ conceptualmente igual, sin diferencias
grandes de campos.

### Inventario → Kardex (`/kardex`)

Filtros: Producto* (buscador con "búsqueda avanzada"), **Bodega** (dropdown
con opción **"Todas las bodegas"**, no solo una bodega puntual), Desde/Hasta.

🆕 **Gap concreto**: nuestro Kardex (`GET /inventario/kardex/:varianteId`)
exige una `bodegaId` puntual — Cuadre permite ver el kardex de un producto
agregado across todas las bodegas a la vez.

### Inventario → Alertas (`/inventory-alerts`)

Dashboard con filtro de Bodega ("Todas las bodegas" / puntual) y 4 tabs:
**Resumen | Stock Bajo | Sin Stock | Por Vencer**, con 4 contadores: Sin
Stock, Stock Bajo, **Por Vencer (7 días)**, **Vencidos** — y dos paneles
"Stock Crítico" / "Próximos a Vencer" con botón "Ver todos" cada uno.

🆕 Gap: panel dedicado y categorizado de alertas (4 tabs) — separa
explícitamente "vencidos" de "por vencer en 7 días", y "sin stock" de
"stock bajo". Nuestro `stockBajoConteo` del dashboard es un solo número.

### Ventas → Clientes (`/customers`)

"Nuevo Cliente": Nombre*, **Categoría** (dropdown de segmentación), Email,
Teléfono, RNC/Cédula, **Límite de crédito** (numérico), **Comprobante fiscal
por defecto** (dropdown — "al seleccionar este cliente en POS, se usará
este tipo de comprobante automáticamente"), Dirección, Ciudad, Notas,
Cliente activo (switch), **Cliente por defecto** (switch — el "cliente
genérico"/walk-in del POS).

🆕 **Gaps concretos**: (1) categoría/segmentación de cliente; (2) límite de
crédito numérico en el cliente mismo; (3) NCF por defecto asignado al
cliente, autoseleccionado en POS; (4) flag "cliente por defecto" explícito.
No se vio campo de listas de precio ni puntos de lealtad en este formulario
(podrían vivir en la vista de detalle/edición, no explorada).

### Ventas → Cierres de Caja (`/cashbox-closes`)

Vista de REPORTE (no solo lista): 4 stat tiles — Total Ventas (+ nº de
sesiones), Sobrantes (nº sesiones), Faltantes (nº sesiones), Diferencia
Total (+ nº "exactas"). Filtros: Fecha desde/hasta, **Estado**
(Todos/Cerradas/Abiertas/**Pendiente revisión**), **Diferencia** (Todas/Solo
sobrantes/Solo faltantes/Sin diferencia), Caja, Cajero. Tabla: SESIÓN,
SUCURSAL, CAJERO, APERTURA/CIERRE, DURACIÓN, **VENTAS (desglosada Ef:/Tj:
inline)**, DIFERENCIA, ESTADO.

"Ver detalle" de una sesión abierta mostró: Estado, Caja, Sucursal, Cajero,
Apertura/Cierre, y dos bloques — **"Montos"** (Monto Apertura, Efectivo,
Transferencia, Tarjeta, **Bono**, **Crédito**, Venta Bruta Total) y
**"Efectivo Esperado"** (Apertura + Ventas Netas = Esperado).

🆕 **Gaps concretos**: (1) estado "Pendiente revisión" — un tercer estado
más allá de abierto/cerrado, probablemente para sesiones con diferencia
fuera de tolerancia que un supervisor debe revisar/aprobar; (2)
reporte-dashboard de cierres con contadores agregados de sobrantes/faltantes/
exactas; (3) desglose de ventas por CADA forma de pago en el detalle del
cierre — nuestro `TurnoCaja` calcula `montoEsperado`/`diferencia` solo sobre
efectivo.

### Cobranza → Cuentas por Cobrar (`/accounts-receivable`)

Dashboard simple: 3 stat tiles (Total CxC, Vencido, Por Vencer), filtro por
Cliente (buscador avanzado), Desde/Hasta, checkbox "Solo vencidas". ✅
conceptualmente cubierto.

### Cobranza → Registrar Cobro (`/collections/new`)

Cliente* (buscador), **Método de Pago*** — dropdown: Efectivo / Tarjeta /
Transferencia / **Crédito Cliente** / Cheque / **Nota de Crédito** (confirma
el hallazgo de la Parte 1: la NC se usa literalmente como forma de pago
acá), Monto*, Referencia.

### No explorado en la Parte 3

Detalle de "búsqueda avanzada" de cliente/producto, vista de detalle/edición
de un Cliente ya creado (posibles campos de lista de precio/puntos de
lealtad no vistos en el alta), confirmar una Compra/Ajuste/Transferencia de
borrador a confirmado, validación de cruce de sucursal en Transferencias con
solo 1 bodega sembrada.

### Resumen de hallazgos de la Parte 3

1. **Patrón Borrador → Confirmado en Compras/Ajustes/Transferencias** — un
   paso intermedio editable antes de impactar inventario.
2. **Motivo de ajuste estructurado** — gap chico y accionable.
3. **Kardex "todas las bodegas" agregado**.
4. **Alertas de inventario segmentadas en 4 categorías con dashboard propio**.
5. **Cliente: categoría/segmentación, límite de crédito, NCF por defecto,
   flag "cliente por defecto"**.
6. **Cierres de Caja como reporte-dashboard** con estado "Pendiente
   revisión" y desglose de ventas por TODAS las formas de pago.
7. **Color por categoría "para POS"**.
8. Sin gaps grandes nuevos en Proveedores, Cuentas por Cobrar o Registrar Cobro.

---

<a id="parte-4"></a>
## Parte 4 — RRHH, Contabilidad, Fiscal DGII, resto de Sistema

Cuarta pasada, solo lectura, corrida en solitario, ningún dato real guardado.

### RRHH → Empleados (`/employees`, vive en Organización, misma vista)

"Nuevo Empleado": Sucursal*, Código*, Nombre*, Apellido*, Tipo/Número de
Documento (Cédula/Pasaporte/RUC/Otro), Teléfono, Email, Dirección, Fecha de
Contratación, **PIN de Acceso (4-10 dígitos)** — "PIN para registro de
asistencia y acceso al POS", **Usuario del Sistema** (asocia el empleado a
una cuenta de usuario — "solo usuarios con rol 'user' o 'manager' asignados
a la sucursal seleccionada"), **Puestos** (checkboxes multi-selección, uno
principal), Empleado activo.

🆕 **Hallazgo clave que responde una duda de la Parte 2**: el PIN de 4-10
dígitos vive en el EMPLEADO (no directamente en el usuario del sistema) y
sirve para dos cosas — marcar asistencia y loguearse en el POS. NO es el
mismo mecanismo que las "Autorizaciones" (que usan email/TOTP de un
supervisor). Son dos capas separadas: PIN de empleado = identificación
rápida operativa; email/TOTP de supervisor = autorización de una acción
sensible.

🆕 Gap: no hay campo de salario/sueldo ni tipo de contrato en esta alta —
probablemente vive en la vista de detalle/edición, no explorada.

### RRHH → Organización → Puestos (`/positions`)

Catálogo pre-sembrado por el sistema (Cajero/Vendedor/Supervisor/Mesero/
Cocina/Bartender/Host-Hostess/Repartidor), cada uno con **"Tipos de
Negocio" aplicables** (Retail/Restaurante/Farmacia/Supermercado — filtra
según el tipo de negocio del tenant). "Nuevo Puesto": Código*, Orden,
Nombre*, Descripción, Tipos de Negocio (checkboxes), Activo.

✅ Concepto ya cubierto por nuestro `Empleado.puesto` (si es texto libre) —
🆕 diferencia: catálogo estructurado propio + filtrado por tipo de negocio,
en vez de texto libre.

### RRHH → Horarios (`/hr/schedules`)

🆕 **Gap de modelo de datos**: un "Horario" en Cuadre es una PLANTILLA
reutilizable (Nombre, Código, Descripción) con 7 filas día-por-día (Laboral
on/off, Entrada, Salida, minutos de Descanso), más un flag **"Horario
predeterminado para nuevos empleados"**. Se asigna a empleados después.
Nuestro `HorarioEmpleado` es una fila por día YA asignada directamente a un
empleado — no hay concepto de plantilla reutilizable ni de "horario
default". Si el negocio tiene 20 cajeros con el mismo horario, Cuadre lo
define una vez y lo reutiliza; nosotros lo definiríamos 20 veces.

### RRHH → Asistencia (`/hr/attendance`)

Lista con filtro de **Estado: Pendiente/Aprobado/Rechazado** — 🆕 gap de
flujo: los registros de asistencia pasan por una APROBACIÓN, no se aplican
automáticamente como en nuestro sistema.

"Registrar Entrada Manual" (uso administrativo): Empleado*, Hora de
Entrada* (fecha+hora), Hora de Salida (opcional), Notas. Sin geolocalización
ni foto visibles en este formulario administrativo.

### RRHH → Ausencias (`/hr/leaves`) — tabs: Solicitudes | Tipos de Ausencia

🆕 **Gap concreto**: "Tipos de Ausencia" es un catálogo TOTALMENTE
configurable por el tenant — "Nuevo Tipo": Nombre*, Código*, **Máximo días
por año** (vacío = sin límite), **Con goce de sueldo** (switch), **Requiere
aprobación** (switch), Activo. Nuestro enum de tipos de ausencia es fijo en
código (con default de `conGoceDeSueldo` hardcodeado por tipo).

Solicitudes: filtro de Estado Pendiente/Aprobado/Rechazado/**Cancelado**.

### RRHH → Nómina (`/hr/payroll`) — tabs: Periodos de Nómina | Deducciones

🆕🆕 **HALLAZGO MÁS IMPORTANTE — TSS/ISR NO están hardcodeados, son un
catálogo de "Deducciones" 100% configurable por el tenant, y vacío por
defecto**:

"Nueva Deducción": Nombre*, Código*, **Tipo de Cálculo** (Porcentaje / Monto
Fijo / **Escalonado**), **Base de Cálculo** (Salario Bruto / Salario Neto),
Porcentaje% (con hint "Ej: 2.87 para AFP, 3.04 para SFS" — ni siquiera
vienen pre-cargadas AFP/SFS), **Obligatoria**, **"Es aporte patronal (no se
descuenta del empleado)"**, Activa.

**Matiz importante**: al elegir "Escalonado" (el tipo que necesitaría el
ISR real, progresivo por tramos), la UI muestra literalmente: *"Los rangos
escalonados se configuran directamente en la base de datos por el
administrador"* — NO es self-service. Esto significa que el ISR real de
Cuadre NO está resuelto vía UI. **No es un gap de Cuadre siendo superior
acá — es un área donde ya vamos adelante** (cálculo real de tramos en
código vs. un placeholder que dice "pedile a soporte que te lo configure").

"Nuevo Período de Nómina": Nombre*, **Tipo de Período** (Semanal/Quincenal/
Bimensual/Mensual), Fecha Inicio/Fin/Pago, **Puestos (opcional)** — "si no
selecciona ninguno, se incluirán todos los empleados con salario asignado".
🆕 gap: filtrado de nómina por puesto/cargo.

No se pudo confirmar la conexión con Comisiones de venta con datos reales
(cuenta de prueba vacía).

### RRHH → Configuración HR (`/hr/config`) — tabs: Configuración | Feriados

🆕 **Integración CrossChex Cloud (ANVIZ)** — switch para recibir
automáticamente registros de asistencia de relojes biométricos.

Configuración de Asistencia: Inicio de Semana Laboral, "País para Cálculos
de Nómina" (heredado de Negocio), **Período de Gracia (minutos, default
15)**, 🆕 **Umbral de Horas Extras (horas/día, default 8)**, 🆕 **Salida
Anticipada (minutos, default 15)**.

Feriados: catálogo propio ("Nuevo Feriado": Nombre*, Fecha*, "Se repite cada
año", Activo).

### Contabilidad → Plan de Cuentas (`/accounting/chart-of-accounts`)

Árbol expandible con 6 raíces (Activos/Pasivos/Patrimonio/Ingresos/
Costos/Gastos). "Nueva Cuenta": Código*, Nivel (1-5), Nombre*, Descripción,
Tipo, Naturaleza (Débito/Crédito), Cuenta Padre. ✅ Cubierto, sin
diferencias grandes.

### Contabilidad → Períodos Fiscales (`/accounting/periods`)

🆕 **Gap concreto y ya documentado como limitación nuestra**: períodos
discretos con Nombre*, Fecha Inicio*, Fecha Fin* — objetos reales que
presumiblemente se pueden cerrar. Nuestro `docs/ARCHITECTURE.md` ya
documenta "no hay cierre de período" (por eso inyectamos "Resultado del
Ejercicio" sintético en el balance).

### Fiscal DGII → Formato 606 / e-CF Pendientes

**606**: Selector Año/Mes, botón "Actualizar", 4 stat tiles (Registros/
Monto Facturado/ITBIS/Total General) como preview, botón "Exportar TXT". ✅
Mismo concepto que nuestros reportes.

**e-CF Pendientes**: cola real con 3 contadores (Pendientes/Fallidos/Total),
filtro por Estado, rango de fechas, buscador — gestiona reintentos de envío
a la DGII como cola operativa real.

### Sistema → Plantillas Email (`/email-templates`)

🆕🆕 **Gap grande**: editor HTML completo con motor tipo Handlebars
(`{{variable}}`, `{{#if}}...{{/if}}`). **5 tipos predefinidos**: Recibo de
Compra, Código OTP, Bienvenida, Restablecer Contraseña, Recordatorio de
Crédito — cada uno con plantilla HTML default ya armada (probado con
"Recibo de Compra": NCF, cliente, tabla de items, subtotal/descuento/ITBIS/
total, método de pago, todo con variables reales). Incluye texto plano
alternativo y toggle activo/inactivo. Nuestras plantillas son fijas en
código.

### Sistema → Biblioteca Medios (`/media`)

Repositorio de imágenes en carpetas fijas: General, Banners, Productos,
Logos. Alimenta a la Tienda Online y a los logos de Negocio.

### Sistema → Mi Perfil (`/profile`)

Información Personal + Cambiar Contraseña. **No incluye** cambio de PIN
propio ni Google Authenticator (eso se configura editando el registro de
USUARIO desde `/users`, no desde el perfil personal — posible inconsistencia
de UX de Cuadre).

### Sistema → Soporte (botón en el header)

Dropdown: "Reportar ticket" (Asunto*, Categoría, Prioridad, Descripción*,
hasta 5 imágenes) y 🆕 **"Mensaje a cajas"** — sugiere broadcast de un admin
a las terminales POS activas.

### No explorado en la Parte 4

Vista de detalle/edición de un Empleado ya creado (posible campo de salario
no visto), flujo de asignación de un Horario-plantilla a un empleado
específico, check-in real vía PIN, conexión real Nómina↔Comisiones con
datos de venta reales, Libro Diario/Estado de Resultados/Balance General,
Formato 607/608/IT-1 y e-CF Mensajería individualmente, RRHH → Reportes,
"Mensaje a cajas" (contenido).

### Resumen de hallazgos de la Parte 4

1. **TSS/ISR configurable pero el modo escalonado no es self-service** — ya
   vamos adelante con el cálculo real en código.
2. **Horarios como plantilla reutilizable con "horario default"**.
3. **Tipos de Ausencia 100% configurables**.
4. **Aprobación de registros de asistencia**.
5. **Integración con relojes biométricos ANVIZ/CrossChex**.
6. **Plantillas de Email con editor completo**.
7. **Umbral de horas extra y tolerancia de salida anticipada configurables**.
8. **Períodos fiscales como objetos reales cerrables**.
9. **Filtrado de nómina por puesto/cargo** y 4 tipos de período.
10. Plan de Cuentas, 606, e-CF Pendientes: sin gaps grandes nuevos.

---

<a id="parte-5"></a>
## Parte 5 — POS, primera pasada (pos.cuadre.do)

**Nota metodológica**: esta pasada corrió en paralelo con la auditoría de
app.cuadre.do en el mismo navegador. La "página seleccionada" se compartió
de forma inestable entre ambas sesiones, interrumpiendo la exploración de
"Guardadas" y del filtro de categorías (completadas en la Parte 6).

### Login y acceso

- `pos.cuadre.do` tiene su **propio login independiente** del backoffice —
  mismo campo "Usuario"/"Contraseña", branding propio ("Cuadre POS"), no la
  misma sesión. Las credenciales del admin del backoffice funcionaron
  también acá.
- Al entrar, cae directo a una caja ya abierta.
- 🆕 **Prompt de instalación PWA** en la pantalla de login. No lo tenemos.

### Pantalla principal — atajos de teclado

Interfaz de una sola pantalla, sin sidebar propio — todo pasa por atajos
F-key, cada uno visible como botón permanente:

| Tecla | Acción |
|---|---|
| F2 | Seleccionar Vendedor |
| F3 | Seleccionar Cliente (+ tipo de NCF) |
| F4 | Devolución (busca factura por número/NCF/cliente) |
| F5 | Refrescar |
| F6 | Cancelar (venta en curso) |
| F7 | Movimiento de Caja |
| F8 | Aplicar Descuento |
| F9 | Cerrar Caja (arqueo) |
| F10 | Cobrar |
| F11 | Facturas (de la sesión actual) |
| F12 | Guardar (venta actual como aparcada) |
| ⇧F12 | Ver Guardadas |

🆕 **Gap real**: nuestro POS tiene *algunos* atajos (`useAtajosTeclado`,
visto en `TurnoCajaDetalle.tsx`) pero no confirmamos que cubran este mismo
set completo de 12 acciones con teclas dedicadas y visibles como botones
permanentes. En Cuadre cada botón de acción ES el atajo, siempre visible —
un cajero experimentado casi no toca el mouse.

- Buscador de producto: "Buscar por nombre, código o escanear..." — soporta
  código de barras. 🆕 detalle: placeholder con hint **"+N/-N para
  ajustar"** — sugiere escribir `+3`/`-2` para ajustar cantidad del último
  producto sin abrir un modal (no confirmado del todo — resuelto
  parcialmente en la Parte 6).
- Filtro "Todos" (categorías) — visible pero no explorado a fondo (sin
  datos suficientes también en la Parte 6).

### Carrito y línea de producto

Cantidad, subtotal/ITBIS/total recalculado en vivo, botones +/- y eliminar
por línea. ✅ Ya cubierto — sin diferencias grandes.

### F3 — Selección de Cliente

Combina DOS decisiones en una sola pantalla:
1. **Tipo de Comprobante Fiscal** como selector en la parte superior del
   MISMO modal.
2. Buscador de cliente por nombre/RNC/teléfono/código.
3. 🆕 Botón **"Nuevo cliente"** dentro del mismo modal.

🆕 **Posible gap**: si en nuestro POS el tipo de factura se define aparte
del cliente, unificarlo agiliza el flujo del cajero.

### F2 — Selección de Vendedor

Modal simple: buscar por nombre/código, navegar con flechas + Enter. ✅ Ya
cubierto — equivalente a nuestro `vendedorEmpleadoId` opcional.

### F7 — Movimiento de Caja

Modal con **Resumen de Caja en vivo** (Apertura, Ingresos, Retiros) visible
ANTES de registrar un nuevo movimiento. Dos botones grandes: "Ingreso" y
"Retiro". ✅ Ya cubierto conceptualmente — diferencia: Cuadre muestra el
resumen acumulado del turno *dentro* del mismo modal.

### F8 — Aplicar Descuento

Modal dedicado:
- Selector de tipo: **"Porcentaje"** o **"Monto Fijo"**.
- Campo numérico (0-100 si es porcentaje).
- **Lista de líneas del carrito con checkbox individual** + botón
  "Seleccionar todos" — contador "Productos (0/1)".
- Botón "Aplicar Descuento" (deshabilitado hasta seleccionar línea+valor).

🆕 **Gap real**: nuestro descuento manual es un campo `descuento` por línea
en el DTO, sin UI dedicada para: (a) elegir % vs monto fijo con cálculo
automático, (b) aplicar el mismo descuento a VARIAS líneas de una vez.

### F9 — Cerrar Caja (arqueo)

"Cierre de Caja - Pesos Dominicanos (DOP)": conteo billete-por-billete y
moneda-por-moneda ($1, $5, $10, $25 monedas; $50, $100, $200, $500, $1,000,
$2,000 billetes), cada denominación con botones -/+ y total parcial en
vivo, más total general "Contado" y botones "Cancelar"/"Confirmar Conteo".

✅ **Ya cubierto casi exactamente igual** — nuestro `ModalCerrarTurno`
(`TurnoCajaDetalle.tsx`) hace conteo por denominación con el mismo concepto.
Diferencia notable: Cuadre etiqueta explícitamente "Moneda" vs. "Billete".

### F11 — Facturas de la Sesión

Panel: "Facturas de la Sesión" con buscador y mensaje "No hay facturas"
cuando está vacío.

🆕 **Posible gap**: lista SIEMPRE accesible (F11) de facturas del turno
actual, buscable, sin salir de la pantalla de venta.

### F4 — Devolución (parcialmente explorado en esta pasada)

Modal **"Buscar Factura"** con buscador global (todo el historial, no solo
la sesión). No se completó el flujo (resuelto en la Parte 6).

### Resumen de gaps priorizados — Parte 5

1. Modal de descuento dedicado (% o monto fijo, multi-selección de líneas).
2. Selección de tipo de NCF integrada al modal de cliente, con "Nuevo cliente" inline.
3. Panel de "Facturas de la sesión" siempre accesible (F11).
4. Atajos de teclado como UI principal, no solo accesorios.
5. PWA instalable.
6. Pendiente de verificar sin interferencia: Guardadas, pago dividido en la
   práctica, devolución completa, variantes/combos en el carrito,
   categorías del catálogo — todo resuelto en la Parte 6.

---

<a id="parte-6"></a>
## Parte 6 — POS, segunda pasada: flujos confirmados con interacción real

Corrida en solitario, sin interferencia. A diferencia de la Parte 5, los
botones de cada atajo eran clickeables directamente. Se generó **una venta
de prueba real** ("CDC TRIPLE ACCION 100ml", RD$240.00) para documentar el
post-cobro y el intento de devolución, y **un movimiento de caja real de
RD$1.00** — el resto se resolvió sin generar más datos reales. No se
confirmó ningún cierre de caja real.

### 1. Guardadas (⇧F12) — ✅ cubierto conceptualmente, con detalle de flujo

Panel "Carritos Guardados": cada guardado muestra Nombre (default
automático tipo "Sin cliente - 10:44 p. m." si no se le pone nombre, o el
que el cajero escriba — placeholder sugiere "Mesa 5, Juan Perez..."),
cantidad de productos, fecha/hora.

🆕 **Detalle de interacción concreto**: la fila NO se retoma con un solo
click — aparece un botón de confirmación separado "Cargar este carrito"
(evita retomar por error un carrito ajeno). El ícono de basurero elimina
inmediatamente sin confirmación ni deshacer. Confirmado con datos reales:
guardé un carrito con 1 producto, lo recargué con éxito (volvió exacto), y
en otra prueba lo eliminé directo.

### 2. Filtro de categorías — sin datos suficientes

La cuenta de prueba solo tiene UNA categoría/vista ("Todos") y UN producto
en todo el catálogo del POS. No se puede confirmar ni descartar el uso del
color "para POS" (visto en Parte 3) — limitación de datos, no un gap real
detectado.

### 3. Cobro con pago dividido (F10) — ✅ CONFIRMADO en la práctica

Flujo real ejecutado: carrito con 1 producto (RD$240.00) → F10 → pantalla
`/checkout` completa (página propia, no modal):

- **Encabezado**: Cliente (default "Consumidor Final"), Vendedor, selector
  de Comprobante Fiscal ("B01 ⇧F3"), 🆕 **selector de moneda en el checkout
  mismo** ("🇩🇴 DOP Peso Dominicano F9").
- **6 formas de pago** con atajo dedicado: Efectivo (F2), Tarjeta (F3),
  Transferencia (F4), Crédito Cliente (F5), Cheque (F6), Nota de Crédito (F7).
- **Pago dividido confirmado con datos reales**: RD$100.00 en Efectivo →
  "Pagos Agregados" lista el pago, "Restante" baja a RD$140.00, el campo se
  auto-rellena con el restante. Agregué Tarjeta por los RD$140.00 restantes
  — **Tarjeta exige un campo "Referencia" obligatorio** antes de habilitar
  "Agregar Pago". Al completarse, "Restante" cambia a **"Cambio"** y se
  habilita "Confirmar Venta".
- **Pantalla post-cobro ("¡Pago Exitoso!")**: Orden # (`20260820-0001`),
  recibo completo (razón social CIGUADR, NCF real: `B010000000100000001`,
  detalle de línea, subtotal/ITBIS/total, "Pagado con: Efectivo, Tarjeta").
- 🆕 **Gap real y concreto**: 4 acciones post-venta con atajo — **Imprimir
  (F2)**, **Email (F3)**, **WhatsApp (F4)**, **Copiar (F5)**. Nuestro POS
  hoy solo imprime vía diálogo del navegador.

### 4. Devolución (F4) — ✅ CONFIRMADO en vivo: dispara el flujo de autorización por email

Busqué la venta de prueba por su número de orden — la encontró. Flujo completo:

1. **"Seleccionar Items a Devolver"**: cantidad a devolver con botones -/+
   (máx. = cantidad original), "Seleccionar todo", **"Motivo de la
   devolución" obligatorio** (textarea libre, no un dropdown estructurado
   como el motivo de ajuste de inventario), "Total a devolver" en vivo.
   Confirma devolución **parcial por línea Y por cantidad**.
2. Al continuar: 🆕🆕 **"Solicitar Autorización"** — *"Se enviará un código
   de autorización al administrador de la sucursal."* con el monto a
   devolver mostrado, botón "Enviar Código".
3. Al presionar "Enviar Código": pantalla **"Verificar Código"** — *"Código
   enviado a: Heriberto Gonzalez (Propietario) - he\*\*\*@gmail.com"*,
   countdown real de expiración ("Expira en 4:52"), input de 6 dígitos,
   botón "Verificar" (deshabilitado sin código).

Confirma en la práctica, con datos reales, exactamente lo que la Parte 2
había documentado desde la pantalla de ajustes: la devolución NO se completa
con un PIN del propio cajero — requiere que un código de un solo uso llegue
al EMAIL del administrador/propietario, con expiración de tiempo. No se
completó la devolución real (no hay acceso al buzón de email) — la venta de
prueba queda "Completada" (no "Devuelta") en el Historial.

**Comparación directa con nuestro PIN de Fase 9**: el de Cuadre es más lento
(depende de revisar email o tener TOTP configurado) pero involucra a un
tercero real. El nuestro es más rápido pero cualquiera que conozca el PIN
memorizado puede reconfirmar sin que nadie más se entere.

### 5. Variantes/combos en el carrito — sin datos suficientes

El catálogo de esta cuenta tiene un único producto simple (sin variantes ni
combo). No se pudo confirmar ni descartar cómo Cuadre maneja variantes/
combos en el carrito del POS — limitación de datos, no un gap detectado.

### 6. F7 y F9 — ✅ ambos completados/documentados a fondo

**F7 — Movimiento de Caja**, formulario "Ingreso de Efectivo" completo:
- Monto* (con selector de moneda propio, F2, atajo F3 para el campo de monto).
- **Motivo\* — dropdown estructurado**: Fondo de cambio / Depósito /
  Corrección / Otro (F4).
- Referencia (opcional, F5), Notas (opcional, F6).
- Ejecuté un Ingreso real de RD$1.00 (motivo "Fondo de cambio") →
  confirmación "Movimiento Registrado" con botón 🆕 **"Imprimir
  Comprobante"** (voucher propio del movimiento, no solo de ventas).

🆕 **Gap concreto**: nuestro registro de movimiento de caja no confirmamos
que tenga un motivo estructurado ni un comprobante imprimible propio.

**F9 — Cerrar Caja**, modal documentado completo (NO confirmado, cancelado
a propósito antes del conteo final para no afectar el turno real): tabla de
10 denominaciones, cada una con botones -/+, spinbutton, subtotal en vivo,
"Total Contado" general, botones "Cancelar"/"Confirmar Conteo". Etiqueta
explícita "Moneda" vs. "Billete" (detalle que nuestro `ModalCerrarTurno` no
replica).

### Resumen de hallazgos de la Parte 6 (todos confirmados con interacción real)

1. **Autorización de devolución por email real, con OTP y countdown de
   expiración** — confirmado en producción, no solo en configuración.
2. **4 canales de entrega del recibo post-venta** (Imprimir/Email/WhatsApp/
   Copiar) — no solo impresión.
3. **Selector de moneda disponible en cada cobro individual y en cada
   movimiento de caja**, no solo en la configuración general.
4. **Pago dividido multi-forma confirmado end-to-end** — Tarjeta exige
   referencia, cambio de etiqueta "Restante"→"Cambio", desglose "Pagado
   con: X, Y" en el recibo.
5. **Devolución parcial por línea y por cantidad**, con motivo en texto
   libre.
6. **Motivo estructurado + comprobante imprimible en movimientos de caja**.
7. Categorías con color y variantes/combos en el carrito: sin datos
   suficientes para confirmar.
8. Cierre de caja (F9): modal completo documentado, comportamiento de
   "diferencia/justificación" post-conteo sigue sin confirmar en la
   práctica.

---

<a id="parte-7"></a>
## Parte 7 — Sitio Web / Tienda Online, auditoría profunda (app.cuadre.do)

Alcance: solo lectura, sin crear/guardar ningún banner/página/cambio de
apariencia real (todo formulario abierto se canceló sin "Guardar"). Se
navegó a las 6 sub-secciones de "Sitio Web" (`/online-store/*`) y al
subdominio público de la tienda (`ciguadr.cuadre.do`) — la tienda de este
tenant está **desactivada**, así que el público devuelve `404 Tienda no
encontrada` (no fue posible ver el catálogo/carrito/checkout reales del
lado del cliente sin activar la tienda, algo que se evitó a propósito por
ser un cambio de estado real y no reversible sin dejar rastro).

### Configuración (`/online-store/settings`)

Toggle **"Tienda en Línea"** (activado/desactivado) — con la cuenta
CIGUADR está OFF ("Tu tienda está desactivada"). Botón **"Ver Tienda"**
enlaza directo a `https://{subdominio}.cuadre.do/`. Formulario
"Información General": Nombre de la Tienda (separado del nombre del
negocio — acá dice "CIGUADR" pero es editable independiente), **Subdominio**
(`ciguadr` + sufijo fijo `.cuadre.do`, validado a solo minúsculas/números/
guiones — **sin campo de dominio propio/custom domain en ningún lado de
esta pantalla**, confirma que el único modo de publicación es el
subdominio de Cuadre), Descripción (textarea libre), Email de Contacto,
Teléfono, Dirección (textarea). Todo en un único formulario con un botón
"Guardar Cambios".

### Apariencia (`/online-store/appearance`)

Editor de tema completo con vista previa en vivo (desktop/móvil) al
costado derecho, reflejando los cambios en tiempo real sobre una tienda de
ejemplo ("Mi Tienda", productos genéricos $99/$149/$79):

- **Tipografías**: 2 selects independientes (Fuente de Títulos / Fuente
  de Cuerpo), 10 opciones cada uno (Inter, Roboto, Open Sans, Lato,
  Poppins, Montserrat, Raleway, Playfair Display, Source Sans Pro,
  Nunito) — típicas fuentes de Google Fonts.
- **Bordes Redondeados**: 5 niveles (Ninguno/Pequeño/Mediano/Grande/Extra).
- **Estilo de Botones**: 3 formas (Cuadrado/Redondeado/Pastilla).
- **Estilo de Tarjetas**: 3 estilos (Plano/Bordeado/Sombra).
- **Encabezado**: estilo (Moderno/Clásico/Minimalista/Centrado) +
  2 toggles (Fijo al hacer scroll / Transparente).
- **Pie de Página**: estilo (Simple/Columnas/Minimalista) + 2 toggles
  (Mostrar Newsletter / Mostrar Redes Sociales).
- **Tarjetas de Producto**: Aspecto de Imagen (Cuadrado/Vertical/
  Horizontal) + 2 toggles (Vista Rápida sin salir de la página / botón
  Agregar al Carrito directo desde la tarjeta).
- **Colores** (color picker + hex manual, con preview swatch), 7 en
  total: Primario, Secundario, Acento (para "elementos importantes como
  ofertas"), Fondo Principal, Superficie (tarjetas/paneles), Texto
  Principal, Texto Secundario — con un aviso de accesibilidad
  ("asegurate de que haya suficiente contraste").
- Botones "Restaurar" (vuelve a los valores por defecto) y "Guardar
  Cambios" (deshabilitado hasta que haya un cambio real).

🆕 Sistema de theming genuino y completo — no son 2-3 campos de color,
es un editor con ~20 controles independientes y preview en vivo.

### Site Builder (`/online-store/builder`)

**Confirmado: es un editor visual real de drag-and-drop, no un
formulario con secciones fijas.** Selector de página (combobox: Inicio,
Productos, Detalle de Producto, Categoría, Carrito, Checkout — cada una
se diseña por separado) + un banco de **16 tipos de widget** arrastrables
al lienzo central: Hero Banner, Productos Destacados, Categorías (grid),
Carrusel de Productos, Bloque de Contenido (texto con formato),
Banner de Imagen, Testimonios, Newsletter, Formulario de Contacto,
Espaciador, HTML Personalizado (código libre), Preguntas Frecuentes,
Equipo, Galería, Estadísticas, Llamada a Acción. Cada widget ya colocado
tiene controles propios: "Visible en móvil" (toggle), "Ocultar", "Eliminar".
Con la cuenta CIGUADR, la página "Inicio" ya trae un **diseño generado
automáticamente** ("basado en tus categorías, productos y banners
existentes") con un widget Hero Banner precargado — el sistema arma un
borrador inicial solo, sin que el usuario tenga que empezar de cero.

Botón **"Templates"** abre un modal con dos categorías:
1. **Estilos de Diseño** (5 presets completos — cambian colores/
   fuentes/imágenes a la vez): Moderno Minimalista (Inter, mucho blanco),
   Elegante y Lujoso (Playfair Display, tonos oscuros/dorados), Colorido
   y Vibrante (Poppins, gradientes), Profesional Corporativo (Source
   Sans Pro, azules/grises), Rústico Artesanal (Merriweather, tonos
   tierra).
2. **Solo Estructura** (3 templates de widgets sin tocar el tema
   actual): Landing Page (7 widgets: hero+servicios+equipo+contacto),
   Tienda Online (6 widgets: productos+categorías), Restaurante
   (7 widgets: menú+reservaciones) — este último confirma que el Site
   Builder de Cuadre apunta a un producto genérico de "sitio web para
   cualquier negocio", no solo e-commerce puro.

🆕🆕 Esto es un page builder tipo Wix/Shopify simplificado — el
gap más grande de todo el catálogo confirmado con evidencia directa
(no solo el nombre del menú).

### Banners (`/online-store/banners`)

Lista vacía en esta cuenta ("No hay banners"). Formulario "Nuevo
Banner": Título, Subtítulo, Descripción (opcionales salvo título);
**Imagen Principal** (obligatoria) + **Imagen Móvil** (opcional, "imagen
optimizada para dispositivos móviles" — confirma que el frontend sirve
distinta imagen según viewport); Texto del Botón + URL del Enlace;
**Posición** (Hero Principal / Barra lateral / Pie de página / Popup —
4 zonas de inserción distintas, no solo el hero de portada); Orden de
visualización (numérico); **Vigencia** (fecha inicio/fin, "dejalas
vacías para mostrar siempre" — mismo patrón de vigencia por fecha que
Ofertas y Bonos); checkbox "Banner activo".

### Páginas (`/online-store/pages`)

Lista vacía en esta cuenta ("No hay páginas creadas"). Formulario
"Nueva Página": Título + Slug (auto-sugerido desde el título, editable,
validado a minúsculas/números/guiones); **Tipo de página** — 7 opciones:
Acerca de, Contacto, Privacidad, Términos, Envíos, Devoluciones,
Personalizada (sugiere que las primeras 6 tienen tratamiento especial
en el footer/menú, aunque el campo de contenido es el mismo textarea
libre para todas — no se pudo confirmar si hay un editor WYSIWYG/rich
text real detrás o es texto plano, el campo se ve como un
`<textarea>` simple sin toolbar de formato visible); sección SEO (Meta
título, Meta descripción — si se deja vacío el meta título usa el
título de la página); Opciones de visualización: Orden numérico,
"Mostrar en menú" (toggle), "Mostrar en footer" (toggle, viene activado
por defecto), "Publicada" (toggle, viene DESACTIVADO por defecto — una
página nueva no es pública hasta activarla explícitamente).

### Pedidos (`/online-store/orders`)

Lista vacía en esta cuenta ("0 pedidos en total", sin poder confirmar
si un pedido se puede convertir a una venta/factura real del backoffice
o si vive en un flujo 100% separado — dato pendiente, ver "no explorado"
abajo). Filtros: rango de fechas, **Estado del pedido** — 7 valores
(Pendiente, Confirmado, Procesando, Listo, Enviado, Entregado,
Cancelado) — y por separado **Estado de Pago** — 4 valores (Pendiente,
Pagado, Fallido, Reembolsado), más búsqueda por orden/cliente/email.
🆕 Confirma que un pedido online tiene un ciclde de vida propio de 7
estados de cumplimiento, independiente y más granular que el de una
`Factura`/`TurnoCaja` de Sistema del Sol o del propio Cuadre backoffice.

### Checkout (`/online-store/checkout`)

Formulario de configuración (no un editor visual, a diferencia del
Site Builder) con 4 bloques:

- **Métodos de Pago**: 3 toggles — Tarjeta de Crédito/Débito,
  Transferencia Bancaria (con un textarea de "Instrucciones de
  transferencia" que se le muestra al cliente en el checkout, ej.
  "Banco Popular, Cuenta 123456789..."), Pago Contra Entrega. **No hay
  ningún selector de proveedor de tarjeta acá** (AZUL/CardNet) — el
  toggle "Tarjeta de Crédito/Débito" es genérico, no se pudo confirmar
  si internamente usa el/los `card-providers` ya configurados en
  Sistema → Proveedores de Tarjeta (ver Parte 4) o si es un campo
  independiente sin conectar todavía.
- **Opciones de Envío**: lista editable de métodos de entrega, cada uno
  con Nombre (texto libre), Precio (RD$), Tiempo estimado (texto
  libre, ej. "3-5 días"), y un botón para eliminar la fila — con 3 filas
  precargadas de ejemplo: "Retiro en tienda" (RD$0), "Envío estándar"
  (RD$150, "3-5 días"), "Envío express" (sin datos de ejemplo, en
  blanco).
- **Campos Requeridos**: 2 toggles — Número de teléfono, Dirección de
  envío (sugiere que sin "Dirección de envío" activado, existe la
  variante "recoger en tienda" sin pedir dirección).
- **Límites de Pedido**: Monto mínimo de pedido (RD$, 0 = sin mínimo) y
  Envío gratis a partir de (RD$, 0 = nunca gratis).

### El subdominio público, desactivado

`https://ciguadr.cuadre.do/` devuelve `404 — Tienda no encontrada` con
la tienda en OFF — confirma que el toggle de Configuración controla el
resolver del subdominio completo (no solo un banner de "en mantenimiento"
encima de la tienda real). No se activó la tienda para ver el catálogo/
ficha de producto/carrito/checkout reales del lado del cliente, por ser
un cambio de estado con efecto público real — queda pendiente si se
decide avanzar con el diseño de A-4 y se autoriza activarla puntualmente.

### No explorado en la Parte 7

Vista del sitio público real (requiere activar la tienda, ver arriba);
detalle de un Pedido individual y si existe un botón/flujo de
"Convertir a factura" hacia el backoffice (sin pedidos de ejemplo en
esta cuenta); si el campo de contenido de una Página es texto plano o
un editor de texto enriquecido real (WYSIWYG) por dentro; conexión real
entre el toggle "Tarjeta de Crédito/Débito" del Checkout y los
`card-providers` (AZUL/CardNet, ítem C-1) ya vistos en Sistema; límite
de banners/páginas por plan; si "Detalle de Producto"/"Categoría"/
"Carrito"/"Checkout" en el Site Builder tienen los mismos 16 widgets
disponibles que "Inicio" o un catálogo reducido específico por tipo de
página.

### Resumen de hallazgos de la Parte 7 (para dimensionar A-4)

1. **Site Builder es un page builder visual real** (drag-and-drop, 16
   tipos de widget, 6 páginas editables por separado, generación
   automática de un borrador inicial, 5 presets de tema completo + 3
   templates de estructura) — no un formulario de configuración con
   secciones fijas. Es, con diferencia, la pieza más grande de A-4.
2. **Apariencia es un theming system independiente y completo** (~20
   controles: tipografía, radios, botones, tarjetas, header/footer,
   7 colores) con preview en vivo — un layer separado del Site Builder,
   que probablemente lo consume como fuente de estilos.
3. **Pedidos online tiene un ciclo de vida de 7 estados propio**
   (Pendiente→Confirmado→Procesando→Listo→Enviado→Entregado→Cancelado)
   más 4 estados de pago separados — no quedó claro si conecta con
   `Factura` del backoffice o es un sistema paralelo; hay que confirmarlo
   con datos reales antes de diseñar el modelo de datos de A-4.
4. **Sin dominio propio (custom domain)** — solo subdominio
   `{nombre}.cuadre.do`, más simple de lo que se podría haber asumido.
5. **Checkout es configuración de métodos de pago/envío**, sin
   conexión visible con los `card-providers` (AZUL/CardNet) de Sistema
   — sugiere que, si se construye A-4, el pago con tarjeta en la tienda
   pública necesitaría su propia integración (posiblemente compartiendo
   adaptador con C-1, pero no confirmado que Cuadre mismo lo reusa).

---

<a id="parte-8"></a>
## Parte 8 — Facturación y Ventas, auditoría profunda + Alertas de Inventario (app.cuadre.do)

Pasada dirigida específicamente a profundizar **Ventas → Facturación**
(solo overview en la Parte 1) y a confirmar en vivo, con interacción
real (crear/ver/cancelar un borrador, no solo mirar listas), el resto
del submenú Ventas — más una revisión enfocada de **Alertas de
Inventario** (`/inventory-alerts`) a partir de un popup del dashboard
reportado por el usuario, ya visto de pasada en la Parte 3.

**Nota operativa**: al probar el campo de línea manual del formulario
de Nueva Factura se descubrió que Cuadre autoguarda un borrador real
(número correlativo propio) con solo escribir, sin ningún botón
"Guardar" — confirmado sin querer, sobre la cuenta real del usuario.
El borrador (`INV-2026-000003`, RD$0.00, sin cliente, sin NCF
consumido) se canceló al terminar la pasada (ver hallazgo #1 abajo,
que documenta exactamente este comportamiento porque resultó relevante
para la comparación).

### 1. Facturación (`/invoices`, `/invoices/new`) — confirmado en vivo

Todo lo que la Parte 1 describió de memoria/una sola mirada se confirmó
tal cual con interacción real: selector de Condición de Pago (Contado/
15/30/45/60/90 Días) con "Vencimiento" recalculado, Tipo de NCF (B01/
B02/B14/B15), botón "Agregar Línea (F6)" que abre una fila con
Descripción/Cant/Precio/Desc %/**ITBIS (checkbox, marcado por
defecto)**/Subtotal, Descuento General (%/$) sobre el subtotal de
líneas. Los 5 gaps que ya listaba la Parte 1 (B14/B15, condición de
pago con plazo, línea manual, ITBIS por línea, descuento general) están
**todos ya en `cuadre-plan-integracion.md`** como B-1/B-6/B-7/B-8
(entregados) y B-9 (línea manual, deliberadamente pendiente por
decisión del usuario 2026-08-24) — nada nuevo que agregar ahí.

🆕 **Hallazgo nuevo #1 — autoguardado de borrador mientras se escribe,
sin botón "Guardar"**: el campo "Descripción" de una línea manual es un
input de autocompletar producto (placeholder "Buscar producto...") que
acepta texto libre si no matchea nada — al escribir la primera letra,
la factura completa YA se persiste como registro real con número
correlativo propio (`INV-2026-NNNNNN`), visible de inmediato en
Facturación **y** en Historial de Ventas (que unifica "Estado: Borrador"
para ambos orígenes, POS y Facturación directa — confirma el hallazgo
de estado "Borrador" ya anotado en la Parte 1). No hay ningún botón
"Eliminar"/"Descartar" en ninguna vista (ni la lista, ni "Ver detalle",
ni el editor) — la única acción disponible sobre un borrador es
"Cancelar" (lo pasa a estado `Cancelada`, permanece para siempre en el
historial, nunca se borra de la base). Relevante para nosotros porque
es **conceptualmente el mismo problema que acabamos de resolver para el
carrito del POS** (`CarritoBorrador`, sesión 2026-08-25/26) pero
aplicado a Facturación de servicios directa, no solo POS — y con una
diferencia de diseño clave: Cuadre lo modela como un registro real de
la entidad (consume un número correlativo desde el primer caracter
tipeado), nosotros optamos por una tabla de borrador aparte e invisible
que nunca consume NCF/correlativo y se borra sola. **No se agrega como
ítem del catálogo** — es una nota de contexto/idea a evaluar si algún
día se decide dar el mismo tratamiento a Facturación directa, no una
brecha confirmada que el usuario haya pedido cerrar.

### 2. Historial de Ventas (`/sales`) — detalle de una venta completada

"Ver detalle" de una venta `Completada` (POS) muestra: Estado/Tipo/
Fecha, Cliente/Cajero/Bodega, NCF, tabla de Productos (Cant/Precio/
Desc/Total), Subtotal/Impuestos/Total, **Pagos** (método + monto), y un
botón **"Generar Nota de Crédito"** directo desde el detalle. ✅ Ya
cubierto conceptualmente (F4 Devolución en nuestro POS hace lo mismo,
reusando el mecanismo de Nota de Crédito — ver ARCHITECTURE.md).

🆕 **Observación (no gap confirmado)**: la venta de ejemplo (Total RD$
480.00) tiene un pago de "Efectivo RD$ 500.00" registrado tal cual —
Cuadre persiste el monto **tendido** completo (incluyendo lo que
después se devuelve como cambio), no el monto neto aplicado a la venta.
En el panel de Facturación esto se ve como "Pendiente: -RD$20.00" en
vez de una cifra explícita de "Cambio/Vuelto". Nuestro
`RegistrarVentaPosDto.pagos[].monto` hace exactamente lo contrario a
propósito ("el cambio nunca se envía", ver el comentario en el DTO) —
el cambio se calcula y muestra solo en el navegador, nunca se persiste.
Ambos enfoques son válidos (el de Cuadre reconciliaría más literalmente
contra "cuánto efectivo físico se contó al recibir el pago" en un
arqueo); no se propone cambiar nuestro criterio sin más contexto de
negocio, solo se deja anotada la diferencia de modelo de datos por si
alguna vez se audita el arqueo de caja a fondo.

### 3. Notas de Crédito, Formas de Pago, Cajas, Bonos — reconfirmado, sin datos nuevos

Las cuatro pantallas coinciden exactamente con lo ya documentado en la
Parte 1 (estados Activa/Parcial/Usada/Cancelada; catálogo de 6 formas
de pago con Tipo/Requiere Ref.; "Caja Principal" con Categorías/
Productos/Favoritos/Impresión "Navegador"; Bonos en lote). El tenant de
prueba no tiene notas de crédito ni lotes de bonos creados — nada que
agregar a los gaps ya catalogados (B-9 no aplica a NC, ver Ventas →
Notas de Crédito en la Parte 1; Bonos ya cubierto por E-10).

### 4. Alertas de Inventario — página dedicada + popup proactivo (`/inventory-alerts`)

La página ya fue descrita en la Parte 3 (4 tabs: Resumen/Stock Bajo/
Sin Stock/Por Vencer, 4 contadores, dos paneles "Ver todos"). Esta
pasada confirma el **drill-down real** de cada tab: tabla Producto/
Bodega/**Stock Mínimo** (columna "-" cuando el producto no tiene mínimo
configurado) — no es un simple conteo, es un listado navegable por
producto.

🆕 **Hallazgo nuevo #2 — popup modal al entrar al dashboard, una vez
por sesión**: al iniciar sesión (o la primera vez que se visita el
Dashboard tras el login), si hay algo en cualquiera de las 4 categorías
aparece un modal centrado — "Alerta de Inventario · N producto(s)
requiere(n) atención" + badges tipo "1 agotado" + botones "Cerrar" /
"Ver Alertas →" (navega a `/inventory-alerts`). Confirmado que NO
reaparece en un segundo refresh de la misma sesión (se suprime después
de mostrarse una vez). Esto es un mecanismo proactivo — el usuario se
entera sin tener que ir a buscar el dato — distinto de nuestro `GET
/reportes/dashboard.alertasInventario` (E-4, entregado 2026-08-24), que
son 4 tarjetas pasivas en `Dashboard.tsx`: si el cajero/admin no entra
al Dashboard y mira, no se entera. **Gap real, agregado como E-12 en
`cuadre-plan-integracion.md`** (página dedicada con drill-down + popup
de sesión) — ver ese ítem para el detalle de alcance propuesto.

### 5. Addendum — revisión de NUESTRO propio flujo de "enviar" (a pedido del usuario)

Cuadre ofrece "Enviar Cotización" (envío real, no probado en vivo para no
disparar un correo real a un cliente real de este tenant de prueba — el
botón es `type="submit"`). Revisando el equivalente en nuestro código en
vez de arriesgar el envío ajeno: **Cotizaciones** SÍ tiene un flujo real
(botón "Enviar" en `CotizacionesPanel.tsx`, visible solo en `BORRADOR` →
`PATCH /cotizaciones/:id/estado` → evento `COTIZACION_ENVIADA` →
`NotificacionesService` manda EMAIL si el cliente tiene `email` y WHATSAPP
si tiene `telefono`); **Facturación** tiene DOS (automático al crearse,
`FACTURA_CREADA`, y manual con destinatario libre, `POST /facturas/:id/
enviar-recibo`, para el caso de POS con "Consumidor Final" sin contacto
propio guardado); **Remisiones no tiene ninguno** (ni botón, ni evento, ni
endpoint).

🆕 **Gap real encontrado, más importante que la asimetría de Remisiones**:
en los TRES casos que sí envían algo, el cliente recibe una notificación de
puro texto ("tu cotización #X por RD$Y fue enviada") **sin ningún link ni
PDF adjunto** — no hay forma de que el cliente vea las líneas, precios o
condiciones reales de lo que le mandaron. `EmailChannel.enviar()` llama a
`nodemailer.sendMail()` sin `attachments` (nodemailer ya lo soporta nativo,
no es una librería nueva) y ninguna plantilla tiene una variable de link.
Agregado como **H-4** en `cuadre-plan-integracion.md` (diseño primero: la
opción que resuelve EMAIL y WHATSAPP a la vez es un link público de solo
lectura, mismo patrón sin-autenticación que `/pagar/:facturaId` de la
pasarela de pago).

### No explorado en la Parte 8

Registrar un pago parcial/completo sobre una factura de Facturación
directa desde su detalle (las 2 facturas de ejemplo ya estaban
`Pagada`, sin ninguna `Pendiente`/`Vencida` para probar el flujo);
enviar una factura "Por correo" de verdad (se ve el botón, no se probó
el envío real); comportamiento de "Registrar Cobro" (Cobranza) contra
una Nota de Crédito real como forma de pago (no hay NC de ejemplo en
este tenant); contenido del dropdown "Ver notificaciones" (campana del
header) — no mostró ningún panel visible al hacer clic en esta pasada,
posiblemente porque no había notificaciones sin leer en el momento.

---

## Síntesis final: qué tenemos, qué no tenemos, qué ya tenemos mejor

Ver el artefacto visual "Radar Cuadre" (publicado en la conversación) para
la versión priorizada y condensada de todos estos hallazgos, organizada por
tamaño de esfuerzo/impacto. Este documento es la fuente completa sin
resumir — usarlo como referencia al planear qué construir (ver
`docs/cuadre-plan-integracion.md`).

**Tres áreas donde YA vamos adelante de Cuadre** (no perder de vista al priorizar):

1. **RBAC granular por permiso** — Cuadre tiene 4 roles fijos, nosotros
   roles personalizados a checkbox por módulo/acción.
2. **Cálculo de ISR por tramos en código** — el modo "Escalonado" de Cuadre
   admite que no es self-service ("se configura en la base de datos").
3. **Cotización/Remisión → Factura de verdad** — Cuadre no tiene Remisiones
   como concepto, y su Cotización es un documento de punta muerta (jamás se
   convierte en Factura: se envía por correo y ahí termina). Nosotros
   convertimos ambas reusando `FacturacionService.crear()` sin duplicar NCF/
   ITBIS/stock — confirmado en vivo, Parte 8.
