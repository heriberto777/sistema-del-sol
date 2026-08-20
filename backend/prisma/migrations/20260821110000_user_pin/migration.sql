-- Fase 9 (adopción de Cuadre): PIN corto de confirmación para acciones
-- sensibles. Todas las columnas nullable/con default — sin backfill de
-- datos, ningún usuario existente queda con PIN configurado.
ALTER TABLE "users"
  ADD COLUMN "pinHash" TEXT,
  ADD COLUMN "pinIntentosFallidos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pinBloqueadoHasta" TIMESTAMP(3);
