-- DropIndex
DROP INDEX "ncf_asignados_tenantId_tipoNcf_key";

-- AlterTable
ALTER TABLE "ncf_asignados" ADD COLUMN "sucursalId" TEXT;
ALTER TABLE "ncf_asignados" ADD COLUMN "umbralAlerta" INTEGER;

-- CreateIndex: sucursalId NULL = secuencia compartida (comportamiento
-- histórico, todas las filas existentes quedan así sin backfill). Postgres
-- no deduplica NULLs en un índice único, así que "a lo sumo una compartida
-- por tipo" se valida en NcfService.crear (código), no acá.
CREATE UNIQUE INDEX "ncf_asignados_tenantId_tipoNcf_sucursalId_key" ON "ncf_asignados"("tenantId", "tipoNcf", "sucursalId");

ALTER TABLE "ncf_asignados" ADD CONSTRAINT "ncf_asignados_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
