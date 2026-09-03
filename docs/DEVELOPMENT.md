# Desarrollo

## Requisitos

- Node 20+, pnpm 9+, Docker.

## Primer arranque

```bash
cp .env.example .env
pnpm install
docker-compose up -d postgres redis n8n
pnpm --filter ./backend prisma:migrate
pnpm --filter ./backend prisma:seed
pnpm --filter ./backend db:app-role
pnpm --filter ./backend db:rls
pnpm dev
```

`db:app-role` crea (o actualiza) el rol de Postgres restringido
(`APP_DB_USER`/`APP_DATABASE_URL` del `.env`) que usa `TenantPrismaService`
para que Row-Level Security proteja de verdad — solo hace falta correrlo
una vez (y de nuevo si cambia `APP_DB_PASSWORD`), antes de `db:rls`. Ver
`docs/ARCHITECTURE.md`, sección "Multi-tenancy".

`pnpm dev` levanta backend (`:3000`, watch mode) y frontend (`:5173`,
Vite) en paralelo. El frontend proxea `/api` hacia el backend
(`frontend/vite.config.ts`), así que no hace falta CORS en desarrollo.

### Corriendo `api`/`web` con Docker (no solo `postgres`/`redis`/`n8n`)

Si además de la infraestructura levantas los contenedores `api`/`web`
(`docker-compose up -d`, sin filtrar servicios), ten en cuenta que
`docker-compose.yml` fija `BACKEND_PORT=3000` **dentro** del contenedor a
propósito, sin importar qué valor tenga `BACKEND_PORT` en tu `.env`. Si
cambias `BACKEND_PORT` para exponer el backend en otro puerto del host
(por conflicto con otro proyecto tuyo), solo afecta el lado izquierdo del
mapeo (`"${BACKEND_PORT}:3000"`) — la app sigue escuchando en el 3000
adentro. No quites ese override: si `BACKEND_PORT` llegara a la app vía
`env_file` sin el override, la app escucharía en el puerto del host
dentro del contenedor y el mapeo de puertos apuntaría a un puerto vacío
(exactamente el bug que tuvo este scaffold durante su verificación
inicial — ver `docker-compose.yml`).

**`node_modules`/Prisma Client desactualizados dentro del contenedor**:
`docker-compose.yml` monta `./backend:/app` (bind mount) pero
`node_modules` es un volumen anónimo aparte, poblado solo en el build de
la imagen. Si agregás una dependencia a `package.json` o cambiás
`prisma/schema.prisma` **después** de haber construido la imagen la
primera vez, el contenedor sigue viendo la versión vieja hasta que
actualices ese volumen a mano:

```bash
docker exec sistema-del-sol-api-1 sh -c "pnpm install --no-frozen-lockfile && pnpm prisma:generate"
docker restart sistema-del-sol-api-1
```

(`--no-frozen-lockfile` evita que pnpm falle cuando `package.json` tiene
dependencias nuevas que el lockfile existente todavía no refleja.)
Alternativa más simple si no te urge preservar la cache de esa imagen:
`docker compose up -d --build api`.

**`pnpm install` en el host salta las devDependencies sin avisar**: si tu
shell tiene `NODE_ENV=production` seteado (puede venir de tu perfil, de
otra sesión, de lo que sea — no tiene nada que ver con este proyecto),
`pnpm install` lo respeta y **no instala** `jest`, `typescript`, etc. —
sin error, solo un `devDependencies: skipped because NODE_ENV is set to
production` fácil de perderse en el output. Si de golpe `pnpm jest`/
`pnpm tsc` dejan de encontrarse, revisá `echo $NODE_ENV` antes de
sospechar del lockfile; el fix es forzarlo para ese comando:
`NODE_ENV=development pnpm install`. Además, este repo es un workspace
pnpm (`pnpm-workspace.yaml`): un `pnpm install` corrido desde `backend/`
opera sobre las 4 paquetes del workspace, no solo sobre `backend` — si
pnpm pide confirmación para "remove and reinstall the modules
directories from scratch" (pasa cuando `node_modules` quedó en un estado
inconsistente, p. ej. por una instalación previa con `NODE_ENV`
distinto), no hay flag no-interactivo confiable para eso en pnpm 9 —
lo más simple es `echo y | pnpm install ...` o borrar `node_modules`
primero.

**Ojo con `docker compose up -d api` (recrear) después de solo editar
`docker-compose.yml`** (por ejemplo, para agregar una variable de
entorno nueva): un `docker restart` normal no relee el compose file, así
que hace falta recrear el contenedor — pero recrearlo reemplaza el
volumen anónimo de `node_modules` por uno nuevo (poblado desde la imagen,
no desde el volumen anterior), así que **cualquier `pnpm prisma:generate`
que hayas corrido a mano dentro del contenedor viejo se pierde** y hay
que repetirlo después de recrear:

```bash
docker compose up -d api                       # recrea con el env nuevo
docker exec sistema-del-sol-api-1 pnpm prisma:generate
docker restart sistema-del-sol-api-1           # opcional, para que Nest recompile limpio
```

**El proxy de Vite (`web`) apunta a `localhost:3000`, que dentro de ese
contenedor es el propio contenedor, no `api`**: cada contenedor tiene su
propio network namespace — `localhost` ahí adentro nunca llega a un
contenedor hermano. Por eso `docker-compose.yml` le pasa
`VITE_API_PROXY_TARGET: http://api:3000` (el nombre del servicio) al
contenedor `web`, y `vite.config.ts` lo lee con
`process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3000'` (ese
fallback es para cuando corrés el frontend fuera de Docker, con
`pnpm dev` en el host). Si tocás ese proxy y volvés a ver
`ECONNREFUSED ::1:3000` en los logs de `web` después de cambiar
`vite.config.ts`, buscá primero un `vite.config.js`/`.d.ts` viejo
sentado junto al `.ts` — Vite lo prefiere sobre el `.ts` fuente sin avisar
(pasó una vez en este scaffold porque `tsconfig.node.json` no tenía
`outDir`; ya está corregido, pero si algo vuelve a emitir ahí, ese
archivo viejo gana en silencio).

## Convenciones de código

- **Backend**: patrón `Controller → Service → Repository` en cada módulo
  de negocio (ver `backend/src/facturacion/` como referencia). Los
  repositorios son el único lugar que toca `TenantPrismaService`/
  `PrismaService` directamente. La lógica de negocio (cálculos, reglas,
  eventos) vive en el `*.service.ts`, nunca en el controller.
- **Nombres**: en español, alineados al dominio (facturación dominicana),
  igual que las tablas de la base de datos.
- **Nuevo módulo de negocio**: crea `dto/`, `<modulo>.repository.ts`,
  `<modulo>.service.ts`, `<modulo>.controller.ts`, `<modulo>.module.ts`;
  regístralo en `backend/src/app.module.ts`. Si necesita reaccionar a
  eventos de otros módulos, suscríbete en el servicio con `@OnEvent(...)`
  en vez de importar el servicio del otro módulo (ver
  `NotificacionesService`/`WebhooksService`).
- **Permisos nuevos**: agrégalos a `PERMISOS_BASE` y al rol correspondiente
  en `backend/prisma/seed.ts`, y decora el endpoint con
  `@Permissions('modulo.accion')`.
- **Frontend**: Atomic Design en `frontend/src/components/`
  (`atoms/molecules/organisms/templates`) — un componente nuevo reutilizable
  empieza en `atoms`, sube de nivel según cuánto composite. Páginas en
  `frontend/src/pages/`, ruteadas en `frontend/src/router.tsx`.
- **Tema claro/oscuro**: `ThemeContext`/`useTheme`
  (`frontend/src/contexts/ThemeContext.tsx`) alternan la clase `dark` en
  `<html>` (Tailwind `darkMode: 'class'`) y persisten en
  `localStorage['sol_tema']`. Un script inline en `index.html` (antes de
  que cargue React) aplica la clase de una vez para evitar el flash de
  tema incorrecto al recargar. Un componente nuevo con soporte de tema
  solo necesita usar las clases `dark:*` de Tailwind — no hace falta leer
  `useTheme()` salvo que su lógica dependa del tema (como el propio
  `ThemeToggle`).
- **Listados nuevos**: si lo que se lista puede crecer sin límite, seguí
  el contrato de `ListadoQueryDto`/`PaginaResultado<T>` (ver
  ARCHITECTURE.md, sección "Listados: búsqueda y paginación") en vez de
  un `findMany()` sin paginar — es el patrón que ya siguen facturas,
  clientes, productos, proveedores, compras, usuarios y notificaciones.

## Tests

```bash
pnpm test          # backend, unitarios (Jest, sin BD)
pnpm test:cov       # backend, unitarios con cobertura
pnpm test:e2e       # backend, e2e (Postgres real vía docker-compose)
pnpm test:ui        # frontend, Vitest
```

**Estrategia**: no se persigue un % de cobertura de línea parejo en todo el
código — los controllers/repositorios delgados (un `findMany` sin lógica)
aportan poco valor unit-testeados aislados. En cambio:

- **Unitarios** (`src/**/*.spec.ts`, mockeando repositorios/event bus):
  cubren la lógica de negocio real — cálculo de ITBIS/margen, la regla de
  "el stock nunca queda negativo", transición de estados de una orden de
  compra, guards de permisos/plugin, utilidades puras (SSRF guard,
  render de plantillas).
- **e2e** (`test/app.e2e-spec.ts`, Postgres real): cubre el camino HTTP
  completo — auth, **aislamiento real entre tenants** (`GET /clientes` de
  un tenant nunca debe traer datos de otro), 401/403, y el flujo de
  facturación de punta a punta (NCF asignado, ITBIS calculado, stock
  descontado). Requiere `docker-compose up -d postgres redis` corriendo.

Esta suite ya encontró y evitó dos bugs reales durante su propia
escritura: `TenantPrismaService` no aislaba correctamente cuando el
provider se instanciaba antes de que el guard de JWT poblara
`request.user` (ver el comentario en `tenant-prisma.service.ts`), y
`findUniqueOrThrow` devolvía 500 en vez de 404 cuando el registro no
existía o pertenecía a otro tenant (ver `PRISMA_STATUS` en
`http-exception.filter.ts`). Al agregar un módulo nuevo con su propio
"buscarPorId", conviene agregar aunque sea un caso de aislamiento al
e2e — es la red que atrapa este tipo de error.

## Prisma Studio

```bash
pnpm --filter ./backend prisma:studio
```

## Agregar un plugin nuevo

Sigue el patrón de `plugins/inmobiliaria/` — ver su `README.md` y
`docs/ARCHITECTURE.md` (sección "Plugin system").

## Despliegue a producción

Mismo patrón que las otras apps del servidor (bonifapp/ciguacash/
ciguainv): imágenes construidas y publicadas a GHCR por CI
(`.github/workflows/deploy-prod.yml`, dispara al terminar CI en `main`),
`docker-compose.prod.yml` en el servidor solo las descarga (nunca
`build:` local) — Postgres/Redis viven en el stack `prop-db` aparte, no
en este compose; `DATABASE_URL`/`APP_DATABASE_URL`/`REDIS_URL` en `.env`
deben apuntar a donde sea que ese stack los exponga.

`api` no publica puerto al host (`expose` solamente) — `web` sí, en
`FRONTEND_PORT_HOST` (8291 en este servidor), y hace de reverse proxy de
`/api/**` hacia `api` dentro de la misma red de compose
(`frontend/nginx.conf`). Nginx Proxy Manager (u otro proxy externo) solo
necesita apuntar a ese puerto — un único Proxy Host con dominio
`app.ciguadev.com` + wildcard `*.ciguadev.com` (ver "Subdominios de
tenant" más abajo), ambos al mismo puerto 8291.

```bash
# en el servidor, primera vez
cp .env.example .env   # completar con los valores reales de producción
docker compose -f docker-compose.prod.yml up -d

# tras cada deploy con migración nueva
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec api pnpm prisma:migrate:deploy
```

La imagen de `api` lleva `node_modules` completo (con devDependencies) a
propósito — permite correr cualquier script operativo
(`prisma:seed`, `platform:bootstrap-admin`, los `*:backfill`) igual que
en dev, vía `docker compose -f docker-compose.prod.yml exec api pnpm
<script>`, sin reconstruir nada. Ver el comentario en
`backend/Dockerfile.prod`.

### Subdominios de tenant

`app.ciguadev.com` es la entrada fija de login para todos los
tenants (`HOSTS_ADMIN` en `frontend/src/router.tsx`, junto con `www`).
Cualquier otro subdominio de primer nivel (`<subdominio>.ciguadev.com`)
sirve la tienda pública de ese tenant directamente en `/` — sin el
`/tienda/:subdominio` de la URL de desarrollo, que sigue funcionando
igual en `localhost` (`resolverContextoTienda()` devuelve `null` para
`localhost`/`127.0.0.1`, para un dominio con menos de 3 labels, y para
`app`/`www`; cualquier otro primer label se usa como subdominio del
tenant). El subdominio de un tenant no puede coincidir con
`SUBDOMINIOS_RESERVADOS` (`backend/src/tenants/subdominios-reservados.ts`)
— validado al crear/editar en `/platform/tenants`.

En Cloudflare (DNS) y en Nginx Proxy Manager hace falta un registro/
Proxy Host wildcard (`*.ciguadev.com`, además de `app.ciguadev.com`) y
el certificado SSL correspondiente (Let's Encrypt vía DNS Challenge en
NPM, ya que un wildcard no se puede validar por HTTP) para que un
tenant nuevo (ej. `emelinda`) funcione en `emelinda.ciguadev.com` sin
tocar configuración de servidor — el enrutamiento por hostname es
enteramente responsabilidad del frontend, la API no cambia nada según
el `Host` de la petición.
