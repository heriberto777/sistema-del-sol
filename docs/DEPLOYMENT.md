# Deployment

El hosting definitivo (VPS propio, DigitalOcean o AWS) está pendiente de
decidir — por eso todo el proyecto está en Docker Compose, portable a
cualquiera de los tres sin cambios de código.

## Ambientes

- **Development**: local, `docker-compose up -d` + `pnpm dev` (hot reload).
- **Staging**: mismo `docker-compose.yml`, `.env` con `NODE_ENV=staging`,
  build de producción (`docker-compose -f docker-compose.yml up -d --build`
  usando el `CMD` de producción — ver más abajo).
- **Production**: igual que staging, con secretos reales (JWT_SECRET,
  SMTP, credenciales MSSQL por tenant) y backups activos.

## Build de producción

Los `Dockerfile` de `backend/` y `frontend/` están pensados para
desarrollo (`CMD pnpm dev`). Para producción:

- **Backend**: `pnpm build` (genera `dist/`), correr con
  `node dist/main.js` en vez de `pnpm dev`. Ajusta el `CMD` del
  Dockerfile o usa un `Dockerfile.prod` con un build multi-stage.
- **Frontend**: `pnpm build` genera un `dist/` estático — sírvelo con
  nginx/Caddy o cualquier CDN, no con `vite dev`.

## Variables de entorno críticas en producción

- `JWT_SECRET`: cambiar el default, usar un secreto largo y aleatorio.
- `DATABASE_URL`, `REDIS_URL`: apuntar a las instancias gestionadas si se
  usa DigitalOcean Managed Databases / AWS RDS+ElastiCache en vez de los
  contenedores de `docker-compose.yml`.
- `CORS_ORIGIN`: dominio real del frontend.
- `SMTP_*`: proveedor de email real (SendGrid, SES, etc.) — con
  `EMAIL_HABILITADO=true`.

## Backups

- **Frecuencia**: diaria (`BACKUP_FRECUENCIA=daily` en `.env`, informativo
  — la ejecución real depende de dónde se aloje Postgres):
  - VPS propio: `pg_dump` vía cron + subida a almacenamiento externo.
  - DigitalOcean Managed Postgres / AWS RDS: backups automáticos nativos,
    configurar la retención deseada.
- **Alertas si falla el backup**: si se usa cron + `pg_dump`, envolver el
  script para que un fallo (exit code ≠ 0) dispare un webhook/email —
  reutilizando `WebhooksService`/`NotificacionesService` si se expone un
  endpoint interno de "backup fallido", o una alerta externa (ej.
  Healthchecks.io) apuntando al cron.
- **Prueba de recuperación**: antes de ir a producción, restaurar un
  backup en un entorno aparte y correr `prisma migrate deploy` +
  `db:rls` para confirmar que el flujo completo de recuperación funciona.

## CI/CD

`.github/workflows/ci.yml` corre en cada push/PR a `main`/`develop`:
lint + build + tests de backend (con Postgres de servicio) y de
frontend. Agregar un job de deploy (a donde se decida alojar) una vez
elegido el proveedor — típicamente `docker build` + push a un registry +
`docker-compose pull && up -d` remoto, o el pipeline nativo del proveedor
elegido (App Platform de DigitalOcean, ECS de AWS, etc.).

## Redundancia

No contemplada en el MVP (un solo servidor por ambiente). Si el
crecimiento lo justifica, el punto de entrada natural es: Postgres
gestionado con réplica de lectura, backend detrás de un load balancer
con 2+ instancias (es stateless salvo por el pool de Prisma), Redis
gestionado.
