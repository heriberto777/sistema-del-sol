-- Rediseño de Soporte Técnico: ReporteTenant pasa de "una respuesta" a un
-- hilo de mensajes (ReporteTenantMensaje). Esta migración crea la tabla
-- nueva, MIGRA los datos existentes (descripcion -> mensaje #1 del
-- tenant, respuesta -> mensaje #2 del equipo de soporte) y recién
-- DESPUÉS elimina las columnas viejas — en ese orden, para no perder
-- datos de reportes ya creados.

-- CreateEnum
CREATE TYPE "AutorMensajeReporte" AS ENUM ('TENANT', 'SOPORTE');

-- CreateTable
CREATE TABLE "reportes_tenant_mensajes" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "autorTipo" "AutorMensajeReporte" NOT NULL,
    "autorUsuarioId" TEXT,
    "autorAdminId" TEXT,
    "cuerpo" JSONB NOT NULL,
    "adjuntoBase64" TEXT,
    "adjuntoNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportes_tenant_mensajes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "reportes_tenant_mensajes" ADD CONSTRAINT "reportes_tenant_mensajes_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "reportes_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_tenant_mensajes" ADD CONSTRAINT "reportes_tenant_mensajes_autorUsuarioId_fkey" FOREIGN KEY ("autorUsuarioId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_tenant_mensajes" ADD CONSTRAINT "reportes_tenant_mensajes_autorAdminId_fkey" FOREIGN KEY ("autorAdminId") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: mensaje #1 por cada reporte existente — el "descripcion"
-- original se vuelve el primer mensaje del hilo, autor TENANT.
INSERT INTO "reportes_tenant_mensajes" ("id", "reporteId", "autorTipo", "autorUsuarioId", "cuerpo", "createdAt")
SELECT
  gen_random_uuid()::text,
  "id",
  'TENANT',
  "usuarioId",
  jsonb_build_object(
    'type', 'doc',
    'content', jsonb_build_array(
      jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', "descripcion")
        )
      )
    )
  ),
  "createdAt"
FROM "reportes_tenant";

-- DataMigration: mensaje #2 — la "respuesta" ya dada (si la había) se
-- vuelve el segundo mensaje del hilo, autor SOPORTE.
INSERT INTO "reportes_tenant_mensajes" ("id", "reporteId", "autorTipo", "autorAdminId", "cuerpo", "createdAt")
SELECT
  gen_random_uuid()::text,
  "id",
  'SOPORTE',
  "respondidoPorId",
  jsonb_build_object(
    'type', 'doc',
    'content', jsonb_build_array(
      jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', "respuesta")
        )
      )
    )
  ),
  COALESCE("respondidoEn", "createdAt")
FROM "reportes_tenant"
WHERE "respuesta" IS NOT NULL AND "respuesta" <> '';

-- DropForeignKey
ALTER TABLE "reportes_tenant" DROP CONSTRAINT "reportes_tenant_respondidoPorId_fkey";

-- AlterTable: ahora sí, se eliminan las columnas viejas (ya migradas arriba)
ALTER TABLE "reportes_tenant" DROP COLUMN "descripcion",
DROP COLUMN "respondidoEn",
DROP COLUMN "respondidoPorId",
DROP COLUMN "respuesta",
ADD COLUMN     "ultimoMensajeEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DataMigration: ultimoMensajeEn arranca en la actividad real de cada
-- reporte (el createdAt del último mensaje migrado), no en "ahora".
UPDATE "reportes_tenant" rt
SET "ultimoMensajeEn" = ultimo."createdAt"
FROM (
  SELECT DISTINCT ON ("reporteId") "reporteId", "createdAt"
  FROM "reportes_tenant_mensajes"
  ORDER BY "reporteId", "createdAt" DESC
) AS ultimo
WHERE ultimo."reporteId" = rt."id";

-- CreateIndex
CREATE INDEX "reportes_tenant_mensajes_reporteId_createdAt_idx" ON "reportes_tenant_mensajes"("reporteId", "createdAt");

-- CreateIndex
CREATE INDEX "reportes_tenant_tenantId_estado_idx" ON "reportes_tenant"("tenantId", "estado");
