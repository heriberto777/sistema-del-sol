# Plugin: Inmobiliaria

Primer plugin del roadmap de Fase 2 (Inmobiliaria → Clínica → Casa de Cambio).
Este directorio es un **stub**: define el manifiesto y un controller de
ejemplo para dejar establecido el patrón que deben seguir los próximos
plugins.

## Instalación (manual, vía git/deploy)

La activación de plugins en esta plataforma es manual — no hay UI de
"subir .zip". Para instalar (o para completar este stub):

1. Agrega los modelos Prisma propios del plugin a `backend/prisma/schema.prisma`
   (ej: `Propiedad`, `ContratoAlquiler`, `ContratoVenta`, `Cobro`), todos con
   `tenantId` y agregados a `TENANT_SCOPED_MODELS`
   (`backend/src/prisma/tenant-scoped-models.ts`).
2. Corre `pnpm --filter ./backend prisma:migrate`.
3. Importa `InmobiliariaModule` en `backend/src/app.module.ts`.
4. Implementa el/los `*.service.ts` y `*.repository.ts` reales (este stub
   solo trae el controller de ejemplo).
5. Por cada tenant que compre el plugin, crea su fila en `tenant_plugins`
   con `pluginKey: "inmobiliaria"` y `activo: true` — `PluginActiveGuard`
   usa esa fila para permitir o denegar acceso a las rutas del plugin.

## Por qué este patrón

- El código del plugin se compila junto al backend (mismo proceso NestJS),
  no como microservicio aparte — más simple de operar a la escala actual
  (~50 tenants).
- La activación por tenant es un dato (`tenant_plugins.activo`), no un
  despliegue distinto — así un mismo release del backend sirve a tenants
  con distintos plugins activos.
- `plugin.json` es lo que `PluginLoaderService` lee al boot para loguear
  qué plugins están disponibles en el código desplegado.
