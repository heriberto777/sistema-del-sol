-- CreateTable
CREATE TABLE "sucursales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- AlterTable: columna nueva nullable — se necesita así para el backfill de abajo.
ALTER TABLE "bodegas" ADD COLUMN "sucursalId" TEXT;

-- Backfill: una "Sucursal Principal" por tenant que ya tenga al menos una
-- bodega, y todas sus bodegas existentes se cuelgan de ella. Preserva el
-- comportamiento de hoy (1 tenant = 1 "local") sin perder ninguna bodega.
INSERT INTO "sucursales" ("id", "tenantId", "nombre", "activa", "createdAt")
SELECT gen_random_uuid(), t."tenantId", 'Sucursal Principal', true, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "tenantId" FROM "bodegas") t;

UPDATE "bodegas" b
SET "sucursalId" = s."id"
FROM "sucursales" s
WHERE s."tenantId" = b."tenantId"
  AND s."nombre" = 'Sucursal Principal';

-- AlterTable: ya migradas todas las bodegas existentes, se puede exigir NOT NULL.
ALTER TABLE "bodegas" ALTER COLUMN "sucursalId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_tenantId_nombre_key" ON "sucursales"("tenantId", "nombre");

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodegas" ADD CONSTRAINT "bodegas_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
