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
2. **Base de datos (RLS, defensa en profundidad, parcialmente
   implementada)**: las policies existen pero **no protegen todavía** —
   nadie ejecuta `SET app.tenant_id` y el rol de Postgres es superusuario.
   No confiar en esta capa en producción sin antes crear un rol sin
   privilegios y envolver cada operación en `SET LOCAL` por transacción.

**Tablas "hijas" sin `tenantId` propio** (`stock`, `precios`,
`linea_factura`, etc.): la inyección automática solo protege si se llega
a ellas vía el padre ya scoped. Si un endpoint recibe un id de la tabla
hija (o del padre) directo del cliente y consulta la hija sin antes
validar que el padre pertenece al tenant, **no hay filtro automático**
(fue un IDOR real). Patrón correcto: resolver primero el padre vía
`TenantPrismaService` (404 si no pertenece) antes de tocar la hija — ver
`InventarioService.validarPertenencia`, `PreciosService`.

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
script (`platform:bootstrap-admin`), nunca por HTTP.

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
proceso compilado, no microservicios). La activación por tenant es un
dato (`tenant_plugins`), consultado por `PluginActiveGuard` +
`@RequiresPlugin('inmobiliaria')` — un mismo release sirve tenants con
distinto plugin activo. Ver `plugins/inmobiliaria/README.md` como
referencia para plugins nuevos.

### Módulos con lógica no obvia (ver ARCHITECTURE.md para el detalle)

- **Cotizaciones/Remisiones**: reutilizan `FacturacionService.crear()`
  para convertir a factura; no duplican NCF/ITBIS/stock.
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
