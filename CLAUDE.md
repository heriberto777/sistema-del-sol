# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

SaaS multi-tenant de facturación para República Dominicana (NCF/ITBIS),
con inventario, precios, compras, contabilidad de partida doble, nómina y
POS, extensible vía plugins (inmobiliaria, clínica, casa de cambio).
Backend NestJS + Prisma + PostgreSQL, frontend React + Vite + TailwindCSS,
workspace pnpm (`backend`, `frontend`, `plugins/*`).

## Comandos

Arranque inicial (requiere Docker, Node 20+, pnpm 9+):

```bash
cp .env.example .env
pnpm install
docker-compose up -d postgres redis n8n
pnpm --filter ./backend prisma:migrate
pnpm --filter ./backend prisma:seed
pnpm --filter ./backend db:app-role   # crea el rol restringido de RLS, una sola vez
pnpm --filter ./backend db:rls        # aplica RLS, correr después de cada migrate
pnpm dev                              # backend :3000 (watch) + frontend :5173 (Vite), en paralelo
```

Login demo tras el seed: `admin@demo.com` / `Admin123!`, tenant `demo`.

Build / lint (desde la raíz, corren ambos paquetes):

```bash
pnpm build:all
pnpm lint
```

Tests:

```bash
pnpm test                                          # backend, unitarios (Jest, sin BD)
pnpm test:cov                                       # backend, con cobertura
pnpm --filter ./backend test:e2e                    # backend, e2e — requiere `docker-compose up -d postgres redis`
pnpm test:ui                                        # frontend, Vitest

# un solo archivo/test (desde backend/)
pnpm jest src/facturacion/facturacion.service.spec.ts
pnpm jest src/facturacion/facturacion.service.spec.ts -t "nombre del test"
```

Prisma:

```bash
pnpm --filter ./backend prisma:migrate        # dev: genera migración + aplica
pnpm --filter ./backend prisma:migrate:deploy # CI/producción
pnpm --filter ./backend prisma:studio
pnpm --filter ./backend platform:bootstrap-admin   # crea el primer super admin de plataforma (no hay alta por HTTP)
```

Ver `docs/DEVELOPMENT.md` para gotchas de Docker (proxy de Vite, volumen
anónimo de `node_modules` desincronizado, `NODE_ENV=production` heredado
del shell que salta devDependencies silenciosamente).

## Arquitectura

La documentación completa vive en `docs/` — **leerla antes de tocar
multi-tenancy, RBAC, contabilidad o cualquier flujo multi-paso**:
`docs/ARCHITECTURE.md` (diseño detallado, con la razón de cada decisión no
obvia), `docs/DATABASE.md` (modelo de datos y reglas de integridad),
`docs/API.md` (endpoints), `docs/DEVELOPMENT.md` (flujo de desarrollo).

### Multi-tenancy: single DB + tenantId + RLS

Una sola base Postgres; `tenantId` en cada tabla de negocio. Dos capas de
aislamiento:

1. **Aplicación (la que realmente protege hoy)**: `TenantPrismaService`
   (`backend/src/prisma/tenant-prisma.service.ts`) es un provider
   *request-scoped* que envuelve Prisma con una Client Extension e inyecta
   `tenantId` automáticamente en toda query, para los modelos listados en
   `TENANT_SCOPED_MODELS` (`backend/src/prisma/tenant-scoped-models.ts`).
   Los repositorios usan `tenantPrisma.client`, nunca `PrismaService`
   directo (salvo listeners de eventos/crons fuera de contexto de request).
2. **Base de datos (RLS, defensa en profundidad — implementada y
   verificada)**: `AppPrismaService` (`backend/src/prisma/app-prisma.service.ts`)
   es un singleton conectado con un rol de Postgres restringido
   (`sol_app`/`APP_DATABASE_URL`, sin superusuario ni `BYPASSRLS`,
   creado con `pnpm --filter ./backend db:app-role`). `TenantPrismaService`
   lo extiende por request y aplica `SELECT set_config('app.tenant_id', ...)`
   dentro de cada transacción (la ya abierta, interceptada con un `Proxy`
   sobre `$transaction`, o una nueva de una sola operación si la llamada es
   suelta) — con un `AsyncLocalStorage` para no re-envolver ni re-setear
   dentro de un mismo `tx`. Solo cubre el tráfico que pasa por
   `TenantPrismaService` (HTTP normal) — los listeners de eventos y el cron
   de `RecordatoriosService` siguen en el rol de siempre (`sol`, sin RLS),
   a propósito (ver ARCHITECTURE.md).

**Tablas "hijas" sin `tenantId` propio** (`stock`, `precios`,
`linea_factura`, `linea_asiento`, etc.): la inyección automática de
`tenantId` en `where`/`data` solo protege si se llega a ellas vía el
padre ya scoped. Si un endpoint recibe un id de la tabla hija (o del
padre) directo del cliente y consulta la hija sin antes validar que el
padre pertenece al tenant, **no hay filtro automático** (fue un IDOR
real). Patrón correcto: resolver primero el padre vía `TenantPrismaService`
(404 si no pertenece) antes de tocar la hija — ver
`InventarioService.validarPertenencia`, `PreciosService`.

Además, con RLS activo, **cualquier query (aunque sea a una tabla hija)
necesita `SET LOCAL app.tenant_id` en la MISMA conexión** si su `where`/
`include` toca (por relación) una tabla padre con RLS forzado — un
`JOIN` implícito hacia una tabla sin ese `SET` la filtra a cero filas
aunque los datos sí pertenezcan al tenant. Por eso el wrapping de SET
LOCAL en `TenantPrismaService` aplica a **toda** operación, no solo a
`TENANT_SCOPED_MODELS`. Y si un helper (ej.
`InventarioService.validarPertenencia`) se invoca desde dentro de una
transacción ya abierta, tiene que recibir y usar ESE `tx` (variantes
`*EnTx`) — si en cambio usa el cliente top-level, la query cae en otra
conexión sin el `SET LOCAL` de esa transacción y RLS la bloquea (bug
real encontrado activando RLS por primera vez, ver ARCHITECTURE.md).

### RBAC

Roles fijos sembrados por tenant (`prisma/seed.ts`), permisos vía
`role_permissions`, `@Permissions('modulo.accion')` + `PermissionsGuard`
en el backend. El frontend también filtra sidebar/botones según
`usuario.permisos` (`AuthContext`) pero es **100% UX, no seguridad** — la
aplicación real siempre es el guard del backend.

Agregar un permiso nuevo a `PERMISOS_BASE`
(`backend/src/tenants/roles-base.ts`) **no** llega a tenants ya
existentes — hay que otorgarlo a mano o migrar datos.

### Auth: plataforma vs. tenant

Dos sistemas separados sin puntos de cruce. Tenant usa `JwtAuthGuard` +
`PermissionsGuard` (secreto `JWT_SECRET`). Plataforma (super admin) usa
`PlatformAuthGuard` (estrategia `'jwt-platform'`, secreto
`PLATFORM_JWT_SECRET`, sin `tenantId`). Los controllers de plataforma
llevan `@Public()` + `@UseGuards(PlatformAuthGuard)` explícito para
esquivar el guard global de tenant. El primer super admin se crea por
script (`platform:bootstrap-admin`), nunca por HTTP — admins adicionales
sí se crean por HTTP (`POST /platform/admins`), una vez que existe al
menos un admin con `platform.admins.gestionar`.

### RBAC de plataforma (equipo del super admin)

Mismo patrón conceptual que el RBAC de tenants, pero como catálogo
global (no por tenant, ver `backend/src/platform-auth/platform-roles-base.ts`):
`PlatformRole`/`PlatformPermission`/`PlatformRolePermission`, con
`PlatformAdmin.roleId` nullable (sin rol asignado, deniega todo lo que
pida un permiso puntual). `@PlatformPermissions('platform.tenants.crear')`
+ `PlatformPermissionsGuard` (`backend/src/common/guards/platform-permissions.guard.ts`)
validan por request.

**`PlatformPermissionsGuard` NO está registrado globalmente vía
`APP_GUARD`** (a diferencia de `ModuloActivoGuard`) — a propósito: Nest
ejecuta los guards globales antes que los de `@UseGuards()` a nivel de
controller, y `PlatformAuthGuard` (el que puebla `request.user` para
rutas de plataforma) es de controller, no global. Si
`PlatformPermissionsGuard` fuera global, correría primero y
`request.user` siempre estaría vacío (bug real, encontrado y corregido
en e2e al implementar esto). Se aplica en cambio junto a
`PlatformAuthGuard`, en ese orden, en cada controller de plataforma:
`@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)`.

### Concurrencia y atomicidad

Varios flujos multi-tabla corren dentro de una sola transacción Prisma
(`$transaction`) con variantes `*EnTx` de los métodos que reciben el `tx`
en vez de abrir el suyo propio: `FacturacionService.crear()/anular()`
(stock + NCF + factura), `InventarioService.transferirStock()`,
`ComprasService.recibir()`. Los correlativos (NCF, número de asiento) usan
`{ increment: 1 }` de Prisma (resuelto por Postgres contra el valor real
de la fila), nunca "leer valor + sumar en JS + escribir" — eso duplica
bajo concurrencia.

### Event Bus

`EventBusService` (`backend/src/event-bus/`, sobre `EventEmitter2`)
desacopla módulos: Facturación/Inventario/Compras/Nómina emiten eventos
(`factura.creada`, `inventario.stock_bajo`, etc.) que Notificaciones,
Webhooks y Contabilidad consumen de forma independiente vía `@OnEvent(...)`
en sus propios servicios — ningún emisor conoce a sus consumidores. Los
listeners corren fuera de un request HTTP: usan `PrismaService` global +
`tenantId` explícito (nunca `TenantPrismaService`, que es request-scoped).

### Plugin system

Instalación manual: cada plugin vive en `plugins/<nombre>/` con su propio
módulo NestJS, importado a mano en `backend/src/app.module.ts` (un solo
proceso compilado, no microservicios). La activación por tenant usa el
mismo mecanismo de Planes/módulos que el resto del catálogo gateable
(`@RequiereModulo('inmobiliaria')`) — un mismo release sirve tenants con
distinto plugin/módulo activo. Ver `plugins/inmobiliaria/README.md` como
referencia para plugins nuevos.

### Planes y módulos activables por tenant

Qué módulos ve/usa cada tenant lo decide la **plataforma** (super admin),
no el propio tenant: un `Plan` (catálogo global,
`backend/src/tenants/modulos-base.ts`) trae un set de `Modulo` incluidos,
y un `TenantModuloOverride` (tenant-scoped) puede forzar un módulo suelto
encendido o apagado para un tenant puntual sin cambiarle el plan entero
— override siempre gana sobre el plan. Resolución centralizada en
`backend/src/planes/resolver-modulos-activos.ts` (funciones puras, no
servicio inyectable) para que `ModuloActivoGuard`
(`@RequiereModulo('clave')`, registrado **globalmente** vía `APP_GUARD`)
y `AuthService.login` (que manda `usuario.modulosActivos` al frontend,
solo UX) nunca puedan divergir. **Contabilidad, Contactos, Reportes,
Notificaciones y Admin quedan siempre activos, sin excepción posible** —
Contabilidad porque genera asientos automáticos consumidos por
Bancos/Gastos Menores (apagarla dejaría huecos en el libro), los demás
por ser plomería compartida entre varios módulos.

Cada `Plan` tiene además `precio` (Decimal) y `cicloFacturacion`
(`MENSUAL`/`ANUAL`) — precio de lista editable desde
`/plataforma/planes`. Un descuento puntual (si aplica) se registra en la
factura de plataforma (ver abajo), nunca en el Plan.

### Suscripción y facturación de plataforma (lo que le cobra la plataforma a cada tenant)

No confundir con `Factura` (lo que un tenant le cobra a SUS clientes).
Cada tenant tiene una `Suscripcion` (1:1, creada automáticamente al
provisionarlo — ver `TenantsRepository.crearConProvisioning`) con
`fechaProximoCorte` y `feeMoraPct`. `FacturasPlataformaCronService`
(`backend/src/facturacion-plataforma/`, patrón `@Cron` igual que
`RecordatoriosService`) corre diario: genera una `FacturaPlataforma` por
cada suscripción `ACTIVA` vencida (monto = precio del Plan en ese
momento, vence el mismo día que se emite) y avanza `fechaProximoCorte`
según `Plan.cicloFacturacion`; y marca `VENCIDA` + aplica `feeMoraPct`
(una sola vez, no compone) a las que pasaron su fecha de vencimiento sin
pago — ambos casos notifican por email al usuario `Admin Total` más
antiguo del tenant (`EmailChannel` directo, HTML inline, sin plantillas
por-tenant). Cambiar el `planId` de un tenant también actualiza el
`planId` de su `Suscripcion` (la próxima factura cobra el precio nuevo).

Pagos (`PagoPlataforma`) siguen el mismo patrón de pagos parciales que
`PagosService` de tenant (`EPSILON = 0.005`, marca `PAGADA` cuando se
cubre el saldo) — ver `PagosPlataformaService`. Una factura
`PENDIENTE`/`VENCIDA` se puede editar (descuento/mora/concepto/fecha de
vencimiento); no se puede anular si ya tiene pagos o si ya está
`PAGADA`. Tenants creados antes de esta feature no tienen `Suscripcion`
automática — correr `pnpm --filter ./backend suscripciones:backfill`
una vez.

**Pasarela de pago** (`backend/src/facturacion-plataforma/pasarela/`):
el admin del tenant paga en línea desde un link público (sin
autenticación) que llega en el email de la factura —
`/pagar/:facturaId` en el frontend, endpoints `/api/pagos-publicos/**`
en el backend. `PasarelaPagoAdapter` es la interfaz común
(`crearSesionPago`); `PasarelaPagoService.activa` resuelve cuál usar
según `PASARELA_PAGO_ACTIVA` (default `stripe`). Solo `StripeAdapter`
está realmente conectado (REST API vía `fetch` nativo, mismo criterio
que `IaClientService` con Anthropic — sin SDK oficial, degrada con
`ServiceUnavailableException` sin `STRIPE_SECRET_KEY`); `AzulAdapter`/
`CardNetAdapter` son stubs que demuestran que el patrón admite sumarlos
después. El webhook (`POST /api/pagos-publicos/webhook/stripe`) verifica
la firma a mano (`stripe-webhook.util.ts`, HMAC-SHA256, sin SDK) y llama
`PagosPlataformaService.registrarPagoGateway` (idempotente — Stripe
reintenta si no recibe 200). **Limitación conocida**: Stripe no liquida
en DOP directo — el cobro de prueba se hace en `STRIPE_CURRENCY`
(default `usd`) con el mismo monto numérico de la factura, sin
conversión de tasa de cambio.

### Módulos con lógica no obvia (ver ARCHITECTURE.md para el detalle)

- **Cotizaciones/Remisiones**: reutilizan `FacturacionService.crear()`
  para convertir a factura; no duplican NCF/ITBIS/stock.
- **`Producto.tipo`** (PRODUCTO/SERVICIO/COMBO): un SERVICIO nunca mueve
  stock; un COMBO expande a sus `componentes` (tabla `ComponenteCombo`)
  al facturarse — nunca tiene fila propia en `Stock`. Todo resuelto en
  `FacturacionService.expandirParaInventario`, el único punto de cambio
  (Cotizaciones/Remisiones/POS lo heredan). Componentes restringidos a
  PRODUCTO/SERVICIO — sin combos anidados. `ComprasService` rechaza
  comprar un COMBO directo y no mueve stock al recibir/devolver SERVICIO.
- **Contabilidad**: partida doble generada automáticamente vía Event Bus
  (`ContabilidadEventosService`), nunca bloquea la venta/compra que la
  originó (try/catch solo loguea). `balanceGeneral()` inyecta una línea
  sintética "Resultado del Ejercicio" porque no hay cierre de período.
- **Nómina**: TSS/ISR según Ley 87-01/11-92 (tasas sin verificar contra
  fuente oficial en tiempo real — confirmar antes de nómina real);
  BORRADOR → PROCESADO → PAGADO, el paso a PAGADO dispara el asiento.
- **POS**: capa delgada sobre Facturación (turno de caja + llamada a
  `FacturacionService.crear()`), sin modo offline.
- **Reportes fiscales DGII (606/607/608)**: layout exacto no verificado
  byte a byte contra la herramienta oficial — validar antes de producción.
- **IA** (`backend/src/ia/`): degrada a heurística sin
  `ANTHROPIC_API_KEY` en vez de fallar; nunca aplica sugerencias
  automáticamente.

### Convenciones de código

- **Backend**: patrón `Controller → Service → Repository` por módulo (ver
  `backend/src/facturacion/`). Solo el repositorio toca
  `TenantPrismaService`/`PrismaService`. Lógica de negocio vive en el
  `*.service.ts`. Módulo nuevo: `dto/`, `<modulo>.repository.ts`,
  `.service.ts`, `.controller.ts`, `.module.ts`, registrar en
  `app.module.ts`; si reacciona a eventos de otro módulo, suscribirse con
  `@OnEvent(...)` en vez de importar el servicio ajeno.
- **Nombres**: en español, alineados al dominio (tablas, DTOs, variables).
- **Frontend**: Atomic Design en `frontend/src/components/`
  (`atoms/molecules/organisms/templates`); páginas en
  `frontend/src/pages/`, rutas en `frontend/src/router.tsx`. Tema
  claro/oscuro vía clase `dark` de Tailwind (`ThemeContext`) — un
  componente nuevo solo necesita clases `dark:*`.
- **Listados que pueden crecer sin límite**: seguir el contrato
  `ListadoQueryDto`/`PaginaResultado<T>`
  (`backend/src/common/dto/listado-query.dto.ts`,
  `backend/src/common/types/pagina-resultado.ts`), nunca `findMany()` sin
  paginar.

### Tests

No se persigue cobertura de línea pareja: controllers/repositorios
delgados aportan poco unit-testeados aislados.

- **Unitarios** (`src/**/*.spec.ts`, mockeando repos/event bus): lógica de
  negocio real (cálculo ITBIS/margen, stock nunca negativo, transiciones
  de estado, guards).
- **e2e** (`backend/test/*.e2e-spec.ts`, Postgres real vía
  docker-compose): camino HTTP completo, y en particular **aislamiento
  real entre tenants** — cualquier módulo nuevo con su propio
  "buscarPorId" debería sumar un caso de aislamiento aquí, es la red que
  atrapa ese tipo de bug (ya encontró dos: `TenantPrismaService`
  instanciándose antes de que el guard poblara `request.user`, y
  `findUniqueOrThrow` devolviendo 500 en vez de 404 entre tenants).
