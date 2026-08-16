-- Rol de Postgres restringido para el tráfico HTTP normal (TenantPrismaService),
-- separado del rol que corre migraciones (POSTGRES_USER, superusuario). Sin
-- privilegios de superusuario ni BYPASSRLS: es lo que hace que las policies de
-- enable-rls.sql (aplicadas después de este script) protejan de verdad. Ver
-- docs/ARCHITECTURE.md, sección "Multi-tenancy".
--
-- Idempotente — correr con: pnpm --filter ./backend db:app-role
--
-- Placeholders sustituidos por scripts/setup-app-role.ts, cada uno escapado
-- para el contexto donde aparece (nunca el mismo token en ambos contextos,
-- para no aplicar el escape equivocado):
--   __APP_DB_USER_IDENT__     -> identificador ("...")  , desde APP_DB_USER
--   __APP_DB_USER_LITERAL__   -> literal ('...')        , desde APP_DB_USER
--   __APP_DB_PASSWORD_LITERAL__ -> literal ('...')      , desde APP_DB_PASSWORD
--   __DB_NAME_IDENT__         -> identificador ("...")  , desde POSTGRES_DB

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '__APP_DB_USER_LITERAL__') THEN
    CREATE ROLE "__APP_DB_USER_IDENT__" WITH LOGIN PASSWORD '__APP_DB_PASSWORD_LITERAL__' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  ELSE
    ALTER ROLE "__APP_DB_USER_IDENT__" WITH LOGIN PASSWORD '__APP_DB_PASSWORD_LITERAL__' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

GRANT CONNECT ON DATABASE "__DB_NAME_IDENT__" TO "__APP_DB_USER_IDENT__";
GRANT USAGE ON SCHEMA public TO "__APP_DB_USER_IDENT__";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "__APP_DB_USER_IDENT__";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "__APP_DB_USER_IDENT__";
-- Para que las tablas de migraciones futuras también queden accesibles sin
-- tener que volver a correr este script cada vez.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "__APP_DB_USER_IDENT__";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "__APP_DB_USER_IDENT__";
