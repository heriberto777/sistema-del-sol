# Esquema del sistema

Mapa de alto nivel de todo el código: qué hace cada módulo, cómo se
relacionan entre sí, y cómo está organizado el código en disco. Es el
punto de entrada para orientarse rápido — para el detalle de **por qué**
cada decisión no obvia es como es, ver `ARCHITECTURE.md`, `DATABASE.md`
(modelo de datos) y `API.md` (endpoints). Para instalar/levantar el
proyecto, ver `DEVELOPMENT.md`. Para agregar un plugin nuevo, ver
`GUIA_PLUGINS.md`.

## Qué es esto, en una línea

SaaS multi-tenant de facturación para República Dominicana (NCF/ITBIS),
con inventario, compras, contabilidad de partida doble, nómina y POS,
extensible vía plugins. Backend NestJS + Prisma + PostgreSQL, frontend
React + Vite + TailwindCSS, workspace pnpm (`backend`, `frontend`,
`plugins/*`).

## Cómo está organizado el código

```
sistema-del-sol/
├── backend/
│   ├── src/
│   │   ├── <modulo>/              # un directorio por módulo de negocio
│   │   │   ├── <modulo>.module.ts
│   │   │   ├── <modulo>.controller.ts
│   │   │   ├── <modulo>.service.ts       # lógica de negocio
│   │   │   ├── <modulo>.repository.ts    # único que toca Prisma
│   │   │   └── dto/
│   │   ├── common/                # guards, decorators, filtros, utils compartidas
│   │   ├── prisma/                # TenantPrismaService / AppPrismaService
│   │   ├── event-bus/             # EventBusService + catálogo de EVENTOS
│   │   ├── plugins/               # PluginLoaderService (ver GUIA_PLUGINS.md)
│   │   └── app.module.ts          # registro manual de TODOS los módulos
│   ├── prisma/schema.prisma       # un solo schema para todo el sistema
│   └── test/*.e2e-spec.ts         # e2e contra Postgres real, por dominio
├── frontend/
│   └── src/
│       ├── components/{atoms,molecules,organisms,templates}/  # Atomic Design
│       ├── pages/                 # una página por pantalla, enrutada en router.tsx
│       ├── hooks/, lib/, contexts/, config/
│       └── router.tsx             # dos árboles de rutas (tienda pública vs. admin)
├── plugins/<nombre>/              # SOLO manifiesto + README de cada plugin
│                                  # (el código real vive en backend/src/<nombre>/)
└── docs/                          # esta carpeta
```

**Patrón `Controller → Service → Repository`**, sin excepciones, en todo
módulo de negocio: el `Controller` solo valida input y delega; el
`Service` tiene la lógica (incluida la que decide si algo es un 400, un
403, etc.); **solo el `Repository` importa `TenantPrismaService`/
`PrismaService`**. Un módulo nuevo sigue siempre esta forma — ver
`GUIA_PLUGINS.md` para el paso a paso completo.

## Multi-tenancy, en una página

Una sola base Postgres, `tenantId` en cada tabla de negocio.
`TenantPrismaService` (request-scoped) inyecta `tenantId` automáticamente
en cada query para los modelos listados en `TENANT_SCOPED_MODELS`
(`backend/src/prisma/tenant-scoped-models.ts`) — por eso todo repositorio
usa `tenantPrisma.client`, nunca `PrismaService` directo (salvo
listeners de eventos/crons, que corren fuera de un request y deben usar
`PrismaService` global + `tenantId` explícito). Row-Level Security en
Postgres es la segunda capa de defensa, ya activa en las 71 tablas
relevantes. Detalle completo, con el porqué de cada decisión no obvia
(tablas "hijas" sin `tenantId` propio, el bug real de RLS+transacciones
ya corregido), en `ARCHITECTURE.md` → "Multi-tenancy".

## RBAC, en una página

Permisos tipo `modulo.accion` (ej. `facturacion.crear`), agrupados en
`Role`s sembrados por tenant al provisionar (`PERMISOS_BASE` en
`backend/src/tenants/roles-base.ts`). `@Permissions('clave')` +
`PermissionsGuard` en cada endpoint es la aplicación real; el frontend
también filtra sidebar/botones con `usuario.permisos`, pero es **100%
UX**, nunca seguridad. Agregar un permiso nuevo a `PERMISOS_BASE` **no**
llega a tenants ya existentes — hay que correr
`pnpm --filter ./backend permisos:backfill` (avisar siempre al hacer
este tipo de cambio).

Plataforma (super admin) tiene su **propio** sistema de auth y RBAC,
completamente separado y sin puntos de cruce con el de tenant — ver
"Auth y RBAC, dos sistemas" más abajo.

## Planes y módulos activables por tenant, en una página

Qué módulos/plugins ve un tenant lo decide la plataforma, nunca el
propio tenant: `Plan` (catálogo global) trae un set de `Modulo`
incluidos; `TenantModuloOverride` fuerza una excepción puntual (gana
siempre sobre el plan). La resolución vive en un único lugar
(`backend/src/planes/resolver-modulos-activos.ts`, funciones puras) para
que el guard (`ModuloActivoGuard` + `@RequiereModulo('clave')`,
registrado globalmente) y el login (`usuario.modulosActivos`, solo UX)
nunca puedan divergir. Contabilidad, Contactos, Reportes, Notificaciones
y Admin quedan siempre activos, sin excepción posible. Detalle completo
en `ARCHITECTURE.md` → "Planes y módulos activables por tenant"; el paso
a paso para que un módulo/plugin nuevo entre a este catálogo está en
`GUIA_PLUGINS.md`.

## Event Bus

`EventBusService` (sobre `EventEmitter2`) desacopla módulos: quien
genera un hecho de negocio (`factura.creada`, `inventario.stock_bajo`,
`cotizacion.convertida_factura`, etc.) no conoce a nadie que reaccione a
eso. Notificaciones, Webhooks, Contabilidad, Comisiones, Lealtad, CRM y
e-CF son los consumidores más comunes — cada uno se suscribe con
`@OnEvent(...)` en su propio servicio. Ver catálogo completo de eventos
en `backend/src/event-bus/events.ts`, y `ARCHITECTURE.md` → "Event Bus"
para los gotchas (listeners corren fuera de contexto de request, nunca
pueden usar `TenantPrismaService`).

## Auth y RBAC, dos sistemas separados

| | Auth de tenant | Auth de plataforma |
|---|---|---|
| Para quién | Usuarios de un tenant (`User`) | Super admins (`PlatformAdmin`) |
| Guard | `JwtAuthGuard` (global, `APP_GUARD`) | `PlatformAuthGuard` (por controller) |
| Estrategia passport | sin nombre (default) | `'jwt-platform'` |
| Secreto | `JWT_SECRET` | `PLATFORM_JWT_SECRET` |
| Permisos | `@Permissions('modulo.accion')` + `PermissionsGuard` (global) | `@PlatformPermissions('platform.algo')` + `PlatformPermissionsGuard` (por controller, **no** global — ver nota abajo) |
| RBAC | `Role`/`Permission`, sembrado por tenant | `PlatformRole`/`PlatformPermission`, catálogo único global |

**Por qué `PlatformPermissionsGuard` no es un `APP_GUARD` global**: Nest
ejecuta los guards globales antes que los de `@UseGuards()` de
controller, y `PlatformAuthGuard` (el que puebla `request.user` para
rutas de plataforma) es de controller. Si `PlatformPermissionsGuard`
fuera global correría primero y `request.user` siempre estaría vacío —
bug real encontrado en e2e al construir esto. Por eso cada controller de
plataforma lleva `@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)`
explícito, en ese orden.

Hay además un **tercer** sistema de auth, más chico: `cliente-tienda-auth`
— login propio del comprador final de la Tienda Online, JWT separado de
los otros dos, sin tabla de usuario propia (reusa `Cliente.passwordHash`).

## Mapa de módulos del backend (`backend/src/`)

Organizados por área de negocio. "Permiso base" es el más representativo,
no la lista completa de ese módulo. "Plugin" significa gateado por
`@RequiereModulo('clave')` y activable/desactivable por tenant — el
resto está siempre disponible (sujeto solo a permisos).

### Núcleo comercial — ventas, inventario, compras

- **`facturacion`** — Núcleo transaccional: crea/anula facturas
  (CONTADO/CRÉDITO/NOTA_CRÉDITO/NOTA_DÉBITO), calcula ITBIS/totales,
  descuenta stock y asigna NCF en una sola transacción. Modelos:
  `Factura, LineaFactura`. Se integra con inventario (descuento de
  stock), pagos, clientes, variantes, ofertas, bonos, lealtad (formas de
  pago especiales), correlativos/NCF, emisión e-CF, autorizaciones
  (anulación con 2FA), notificaciones. Permiso base: `facturacion.crear`
  / `.ver` / `.anular` / `.cobrar`.
- **`cotizaciones`** — Presupuestos con vigencia, convertibles 1:1 a
  Factura reusando `FacturacionService`. Modelo: `Cotizacion,
  LineaCotizacion`. Permiso base: `cotizaciones.crear` / `.editar` /
  `.ver`.
- **`remisiones`** — Entrega de mercancía sin facturar todavía (guía de
  despacho), también convertible a Factura. Permiso base:
  `remisiones.crear` / `.editar` / `.ver`.
- **`pos`** — Punto de venta: turno de caja + carrito + venta rápida,
  delgado sobre `FacturacionService.crear()`. Modelos: `TurnoCaja,
  CarritoBorrador, VentaAparcada, MovimientoCaja, PagoVenta`. Plugin
  (`pos`). Permiso base: `pos.editar` / `.supervisar`.
- **`compras`** — Órdenes de compra a proveedor, recepción (mueve
  stock) y devoluciones. Modelos: `OrdenCompra, LineaOc,
  LineaRecepcion`. Plugin (`compras`). Permiso base: `compras.crear` /
  `.editar` / `.pagar`.
- **`inventario`** — Stock por bodega, movimientos y lotes
  (vencimiento). Incluye 3 submódulos propios: **`ajustes-inventario`**
  (`inventario.ajustar`), **`transferencias-inventario`**
  (`inventario.transferir`) y **`conteo-fisico`** (conteo a ciegas,
  reusa Ajustes, `inventario.contar`). Modelos: `Stock,
  MovimientoInventario, Bodega, Lote`. Tiene `LotesCronService` propio
  (vencimientos). Plugin (`inventario`). Permiso base: `inventario.ver`
  / `.ajustar` / `.transferir` / `.contar`.
- **`productos`** — Catálogo maestro de artículos
  (PRODUCTO/SERVICIO/COMBO), con endpoint público aparte para servir la
  imagen (usado como `mediaUrl` de WhatsApp). Modelos: `Producto,
  ComponenteCombo`. Plugin (`productos`). Permiso base: `precios.ver` /
  `.editar`.
- **`precios`**, **`categorias`**, **`categorias-cliente`**,
  **`listas-precio`**, **`atributos`**, **`formas-pago`**,
  **`correlativos`** — catálogos de apoyo chicos, sin lógica de negocio
  compleja propia, cada uno con su propio CRUD y permiso heredado del
  dominio al que sirve (`precios.*` o `admin.configuracion`).
- **`variantes`** — Resolución de variante obligatoria al
  facturar/vender y generación de código de barras (EAN-13/Code128).
  Modelo: `VarianteProducto`.
- **`clientes`** — Ficha de cliente, estado de cuenta y su envío por
  email/WhatsApp. Modelo: `Cliente`. Permiso base: `clientes.crear` /
  `.editar` / `.ver`.
- **`proveedores`** — Ficha de proveedor para Compras. Modelo:
  `Proveedor`. Sin permisos propios (comparte los de Compras).
- **`cuentas-por-cobrar`** / **`cuentas-por-pagar`** — Vistas agregadas
  (no transaccionales) de facturas/compras a crédito pendientes, global
  por tenant. Permiso base: `cuentasporcobrar.ver` /
  `cuentasporpagar.ver`.
- **`pagos`** — Servicio compartido de registro de pagos parciales
  contra Factura u OrdenCompra, con asiento contable automático. Sin
  controller propio — se inyecta en Facturación/Compras/CxC/CxP.
- **`ncf`** — Configuración de secuencias de NCF/e-CF y modalidad de
  facturación del tenant (incluye el interruptor "sin comprobante
  fiscal" para negocios que no son contribuyentes de la DGII). Permiso
  base: `admin.configuracion`.
- **`ofertas`** — Descuentos automáticos por línea/carrito, con reparto
  proporcional. Permiso base: `ofertas.ver` / `.editar`.
- **`comisiones`** — Comisión de venta por vendedor, calculada por
  evento (`@OnEvent`, no inyección directa). Permiso base:
  `comisiones.ver`.
- **`lealtad`** — Puntos de lealtad: acumulación por evento, canje como
  forma de pago, expiración por cron.
- **`bonos`** — Certificados de regalo canjeables como forma de pago,
  con cron de expiración.
- **`cajas`** — Catálogo de cajas registradoras físicas/puntos de
  cobro.
- **`tasas-cambio`** — Catálogo manual de tasas de cambio (presentación
  multi-moneda).
- **`sucursales`** — Catálogo de sucursales y acceso de usuario por
  sucursal — exporta solo el `Repository` (no el `Service`) para que
  otros módulos validen pertenencia de FK (patrón anti-IDOR).

### Finanzas, nómina y reportes

- **`contabilidad`** — Partida doble (catálogo de cuentas, asientos,
  líneas), estados financieros y cierre de período. Modelos:
  `CuentaContable, AsientoContable, LineaAsiento,
  PeriodoContableCerrado`. Nadie la importa directo — el resto de los
  módulos de venta/compra le generan asientos vía Event Bus
  (`ContabilidadEventosService`). **Siempre activa**, nunca
  `@RequiereModulo`. Permiso base: `contabilidad.ver` / `.editar` /
  `.anular` / `.conciliar`.
- **`bancos`** — Cuentas bancarias y conciliación. Plugin (`bancos`).
  Permiso base: `bancos.ver` / `.editar`.
- **`gastos-menores`** — Caja chica, con comprobante de compra al
  mercado informal (NCF B11/E43); genera su propio asiento vía
  Contabilidad. Plugin (`gastosmenores`).
- **`nomina`** — Suite completa de RRHH: empleados, períodos de nómina
  (TSS/ISR), horarios, asistencia y ausencias. Exporta
  `EmpleadosRepository` para que POS resuelva el vendedor sin exigir el
  módulo Nómina. Depende de `puestos`, `plantillas-horario`,
  `feriados`. Plugin (`nomina`). Permiso base: `nomina.ver` / `.editar`,
  `rrhh.*`.
- **`puestos`**, **`feriados`**, **`plantillas-horario`**,
  **`leyes-fiscales`** — catálogos de apoyo (puestos/feriados/horarios
  de Nómina; leyes fiscales reduce el ITBIS efectivo de un producto).
- **`reportes`** — Hub transversal único de reportes (dashboard,
  ventas/comisiones, inventario, compras, financieros), exportable a
  Excel/PDF, con cache corto en Redis. Sin tabla propia. Permiso base:
  `reportes.ver`.
- **`reportes-fiscales`** — Reportes DGII 606/607/608, exportables a
  TXT con el layout oficial. Independiente de `reportes` (no se
  importan entre sí). Sin tabla propia.
- **`recordatorios`** — Cron diario de cobro de facturas a crédito
  vencidas/por vencer. Sin controller HTTP.
- **`auditoria`** — Expone lo que graban pasivamente
  `AuditLogInterceptor` (global) y el filtro de excepciones
  (`ErrorLog`). Solo lectura.
- **`tareas-personales`** ("Mis Tareas") + **`categorias-incentivo`** —
  tareas personales con comentarios, sin jerarquía de permisos (solo
  dueño); envío de resumen con ayuda de IA. Plugin (`mistareas`), sin
  `@Permissions` propio.
- **`autorizaciones`** — Segunda capa de autorización (código de un
  solo uso enviado por email a un tercero) para anular factura/
  devolución, opcional por tenant. Sin controller propio, se inyecta
  desde Facturación/POS.

### Plataforma, tenants y autenticación

- **`auth`** — Login/JWT/recuperación de contraseña de usuarios de
  tenant. Revalida `Tenant.estado` en cada request (no solo al emitir el
  token). Exporta `AuthService` (usado por `verificarPin()` en
  Facturación/POS).
- **`tenants`** — CRUD de tenants desde Plataforma (crear con
  provisioning completo, editar, suspender/reactivar, resetear) +
  dominios propios. Permiso base: `platform.tenants.*`.
- **`tenant-empresa`** — Datos propios editables por el propio tenant
  (nombre, RNC, dirección, logo). Permiso de **tenant**:
  `admin.configuracion` (no de plataforma).
- **`usuarios`** — CRUD de usuarios de un tenant. Permiso único:
  `admin.usuarios`.
- **`configuraciones`** — Catálogo genérico clave/valor por tenant
  (`ITBIS_GENERAL`, `FORMATO_IMPRESION_DEFAULT`, etc.) — mecanismo
  transversal de parámetros sin tabla dedicada por cada uno.
- **`planes`** — Catálogo global `Plan`/`Modulo` + resolución de
  módulos activos (`resolver-modulos-activos.ts`) + overrides
  puntuales. Permiso base: `platform.planes.*`.
- **`platform-admins`** — Super admins de Plataforma + su propio RBAC
  (`PlatformRole`/`PlatformPermission`, catálogo global separado).
- **`platform-auth`** — Autenticación de super admin, 100% separada de
  `auth` (ver tabla más arriba).
- **`platform-audit-log`** — Solo lectura del audit log de plataforma.
- **`platform-dashboard`** — Agregados para la pantalla principal de
  Plataforma.
- **`plataforma-config`** — Fila única de configuración global
  (SMTP/Twilio/pasarela de pago/webhook), secretos cifrados,
  `sincronizarEnv()` sin reiniciar. Dependencia de casi todo lo que
  manda notificaciones/webhooks de plataforma.
- **`facturacion-plataforma`** — Lo que la PLATAFORMA le cobra a cada
  tenant (`FacturaPlataforma`, distinto de `Factura`): generación
  recurrente, pagos parciales, pasarela Stripe, cupones,
  auto-suspensión/auto-reactivación de tenants morosos.
- **`ncf-plataforma`** — NCF que la PLATAFORMA emite en sus propias
  facturas a los tenants (separado del `ncf` de cada tenant).
- **`health`** — Healthcheck público, sin lógica.
- **`redis`** — Wrapper de cliente Redis, `@Global()`.

### Plugins (activables/desactivables por tenant)

Todos siguen el mismo patrón: código en `backend/src/<nombre>/`,
manifiesto informativo en `plugins/<nombre>/plugin.json` — ver
`GUIA_PLUGINS.md` para el mecanismo completo.

- **`crm`** — Leads, Pipeline, Oportunidades, Actividades, ficha 360°
  del cliente, y "El ancla" (resuelve si un teléfono de WhatsApp ya es
  Cliente/Lead). Se integra con Clientes, Cotizaciones, Lealtad,
  WhatsApp Bot (solo lectura). Clave: `crm`.
- **`proyectos`** — Proyectos con hitos facturables, tareas, "Generar
  tareas con IA". Facturar un hito real reusa `FacturacionService`.
  Exporta su repositorio para que Inmobiliaria lo reuse en preventa.
  Clave: `proyectos`.
- **`inmobiliaria`** — Catálogo de propiedades (venta/alquiler/
  preventa), contratos+comisión, cobro de alquileres, portal público.
  La preventa reusa Proyectos en vez de tener sistema de hitos propio.
  Clave: `inmobiliaria`. **Referencia del patrón a seguir para un plugin
  nuevo** — ver `plugins/inmobiliaria/README.md`.
- **`ecommerce`** — Tienda Online: storefront público por subdominio
  (auth propia, `cliente-tienda-auth`), carrito, pedidos, secciones
  dinámicas, dominio propio. Clave: `ecommerce`. El storefront público
  valida el módulo a mano en `resolverTiendaPublica` (no puede usar
  `@RequiereModulo`, no tiene `request.user`); los 2 controllers del
  panel admin (`EcommercePedidosController`/`SeccionesTiendaController`)
  llevaban solo `admin.configuracion` sin `@RequiereModulo('ecommerce')`
  — un tenant sin el módulo podía igual gestionar pedidos/secciones por
  API directa. Corregido 2026-10-19.
- **`travel`** (+ `travel-config`) — Búsqueda/reserva de vuelos (Duffel)
  y hoteles (Hotelbeds) con credenciales **por tenant**. Clave:
  `travel`.
- **`publicaciones-sociales`** — Banners para redes sociales con fondo
  generado por IA y flujo de aprobación. Clave: `publicacionessociales`.

### Infraestructura transversal (siempre activa, no son plugins)

- **`ia`** — Análisis de imagen multi-proveedor, conversación
  (consumida por el Bot y Proyectos), generación de fondo, tracking de
  uso. Gateada igual por `@RequiereModulo('ia')` pese a no ser un
  "plugin" narrativo.
- **`whatsapp-bot`** (+ `whatsapp-config`) — Bot conversacional vía
  Twilio: webhook entrante, escalamiento a humano, Bandeja de atención
  (responder, marcar atendido, enviar factura/cotización/estado de
  cuenta real). Exporta su repositorio de mensajes para la ficha 360°
  del CRM.
- **`notificaciones`** — Orquesta avisos (factura creada, stock bajo,
  etc.) por canal (`EmailChannel`/`WhatsAppChannel`) según plantilla
  configurada por tenant+evento+canal. Nadie la importa — los
  consumidores se suscriben vía Event Bus.
- **`webhooks`** — Webhooks salientes configurables por tenant, con
  guard anti-SSRF.
- **`documentos-publicos`** — Endpoints `@Public()` de solo lectura/PDF
  para que un cliente vea SU factura/cotización/estado de cuenta desde
  un link, sin cuenta. El UUID actúa como capability token implícito.
- **`pasarela-cobro`** — Pasarela de **tenant** (Azul/CardNet) para que
  el tenant cobre SUS facturas por link público — distinta de la
  pasarela de **plataforma** (Stripe, cobra a los tenants, vive en
  `facturacion-plataforma/pasarela/`).
- **`personalizacion-documentos`** — Branding por tipo de documento
  (logo, color, QR, firma, layout de bloques).
- **`emision-ecf`** — Emisión real de e-CF contra la DGII vía Alanube.
  Aplica solo cuando `Tenant.modalidadFacturacion = ECF`.
- **`cliente-tienda-auth`** — Auth del comprador final de la Tienda
  Online, infraestructura del plugin `ecommerce`.
- **`email-config-tenant`** — SMTP propio por tenant (si no lo carga,
  cae al SMTP compartido de plataforma).

## Mapa del frontend (`frontend/src/`)

### Atomic Design (`components/`)

- **`atoms/`** (~7): piezas visuales puras sin lógica de negocio —
  `Avatar`, `Badge`, `Button`, `Card`, `Input`, `Select`, `Switch`.
- **`molecules/`** (~40): combinan 2+ atoms o agregan una interacción
  puntual — `Modal` (overlay base de casi todos los formularios),
  `ComboboxBusqueda` (buscador+selección genérico y tipado),
  `FormularioCliente`.
- **`organisms/`** (~105): bloques de página completos, normalmente con
  su propio `useQuery`/`useMutation` — `CatalogoProductosPos`,
  `BandejaWhatsappDrawer`, `ConversacionWhatsapp`.
- **`templates/`** (2): `AppLayout` (sidebar+header del admin de
  tenant) y `PlatformLayout` (análogo para `/plataforma`).

Un componente nuevo va en el nivel que corresponda a su complejidad —
nunca un "organism" gigante que podría dividirse, ni lógica de negocio
filtrada a un "atom".

### `router.tsx`

Dos árboles de rutas completamente separados, elegidos en runtime por
`crearRouter(subdominio)` según el hostname: `RUTAS_HOSTNAME_TENANT`
(un subdominio de tienda → solo monta el storefront público) y
`RUTAS_ADMIN` (todo lo demás — login, `/plataforma/**` con
`PlatformLayout`, y el resto del ERP con `AppLayout`). `/pos/caja/:turnoId`
queda deliberadamente fuera de `AppLayout` (pantalla completa, sin
sidebar). Sin lazy loading — todos los imports son estáticos.

### `pages/` (~103 archivos + subcarpetas `inmobiliaria/`, `tienda/`)

Una página por pantalla, agrupadas temáticamente por nombre: Ventas,
Inventario, Compras, Finanzas, Nómina/RRHH, POS, CRM, Proyectos,
Inmobiliaria, Travel, Publicaciones Sociales, Tienda Online (admin +
storefront público), Seguridad/Admin, Auth/públicas, y Plataforma (super
admin, prefijo `Platform*`).

### `hooks/`, `lib/`, `contexts/`, `config/`

- **`hooks/`**: la mayoría envuelven un `useQuery` reusable
  (`useLeyesFiscales`, `useListasPrecio`, `useCarritoTienda`, etc.);
  aparte, `useAuth`/`usePlatformAuth` (sesión) y hooks de UI/estado
  local (`useTheme`, `useAtajosTeclado`, `useDebouncedValue`).
- **`lib/`**: clientes HTTP (ver abajo), formato/presentación
  (`fecha.ts`, `iniciales.ts`), helpers de dominio
  (`cuentas-aging.ts`, `etiquetas-codigo-barras.ts`), y
  `mensaje-error-api.ts` (obligatorio en todo `onError` de mutation).
- **`contexts/`**: `AuthContext` (sesión de tenant), `PlatformAuthContext`
  (sesión de plataforma, separada), `ThemeContext`,
  `SucursalActivaContext`.
- **`config/`**: solo `menu-erp.ts` — el menú del Sidebar
  (`DominioMenu`/`CategoriaMenu`/`ItemMenu`, cada ítem puede exigir
  `permisos` y/o `modulo`; ver `GUIA_PLUGINS.md` para cómo agregar una
  entrada nueva).

### Clientes HTTP (6, ninguno comparte instancia)

| Cliente | Para qué | Interceptores |
|---|---|---|
| `apiClient` | Sesión de tenant | `Authorization` desde `sol_access_token`; 401 limpia sesión y redirige a `/login` |
| `platformApiClient` | Sesión de plataforma | Igual, con `sol_platform_token`, redirige a `/plataforma/login` |
| `tiendaApiClient` | Storefront público | Ninguno — nunca hay sesión, nunca redirige en 401 |
| `cobros-publicos-api-client` | Link público de cobro de factura de tenant | Ninguno |
| `documentos-publicos-api-client` | Link público de ver documento | Ninguno |
| `pagos-publicos-api-client` | Pasarela de plataforma (Stripe) | Ninguno |

## Para profundizar

| Pregunta | Dónde leer |
|---|---|
| "¿Por qué esta decisión no obvia es así?" (RLS, concurrencia, ofertas, kardex, lotes FEFO, multi-moneda, POS, nómina, etc.) | `ARCHITECTURE.md` |
| "¿Qué forma tiene la tabla X? ¿Qué reglas de integridad tiene?" | `DATABASE.md` |
| "¿Qué endpoints existen y qué devuelven?" | `API.md` |
| "¿Cómo levanto el entorno de desarrollo?" | `DEVELOPMENT.md` |
| "¿Cómo integro un plugin nuevo?" | `GUIA_PLUGINS.md` |
| "¿Cómo se despliega a producción?" | `DEPLOYMENT.md` |
