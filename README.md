# El Sistema del Sol

Plataforma SaaS modular de facturación para República Dominicana. ERP
extensible con sistema de plugins, multi-tenant, para empresas que
necesitan facturación (NCF/ITBIS), inventario, precios y compras — con
plugins adicionales para inmobiliaria, clínica y casa de cambio.

## Stack

- **Frontend**: React 18 + TypeScript + TailwindCSS + Atomic Design + React Query
- **Backend**: NestJS + TypeScript + Prisma + PostgreSQL
- **Infraestructura**: Docker Compose (Postgres, Redis, n8n self-hosted)
- **Multi-tenancy**: single DB + `tenantId` + Row-Level Security (defensa en profundidad)

## Quickstart

```bash
cp .env.example .env
pnpm install
docker-compose up -d
pnpm --filter ./backend prisma:migrate
pnpm --filter ./backend prisma:seed
pnpm --filter ./backend db:app-role
pnpm --filter ./backend db:rls
pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs
- n8n: http://localhost:5678

Usuario demo (creado por el seed): `admin@demo.com` / `Admin123!`, tenant `demo`.
El seed también crea una bodega ("Principal"), un producto ("DEMO-001",
RD$150 con ITBIS 18%) y las secuencias de NCF — suficiente para crear una
factura de prueba (`POST /api/facturas`) sin configurar nada más.

### Dar de alta un tenant (cliente) nuevo

Los tenants nuevos se gestionan desde el **portal de plataforma**
(`/plataforma/login`), separado del login normal — ver
`docs/ARCHITECTURE.md` ("Auth de plataforma vs. tenant"). El primer super
admin se crea desde el servidor, no por HTTP:

```bash
PLATFORM_ADMIN_EMAIL=tu@correo.com PLATFORM_ADMIN_PASSWORD=algo-seguro \
  pnpm --filter ./backend platform:bootstrap-admin
```

Con eso, entra a `http://localhost:5173/plataforma/login` y desde ahí das
de alta cada tenant nuevo — se le siembran automáticamente sus roles,
permisos, configuración por defecto y su usuario administrador inicial.

## Estructura

```
sistema-del-sol/
├── backend/          NestJS — Controller → Service → Repository
├── frontend/          React + Vite — Atomic Design
├── plugins/           Plugins instalables manualmente (ver plugins/inmobiliaria)
├── docs/              Documentación de arquitectura, API, BD, desarrollo y deploy
└── docker-compose.yml
```

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para el diseño detallado
(multi-tenancy, plugin system, event bus), [docs/DATABASE.md](docs/DATABASE.md)
para el modelo de datos, [docs/API.md](docs/API.md) para los endpoints,
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) para el flujo de desarrollo y
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para despliegue.
