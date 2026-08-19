-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoriaPadreId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- AlterTable: columna nueva nullable, todavía sin FK ni dropear la vieja —
-- se necesitan ambas presentes para el backfill de abajo.
ALTER TABLE "productos" ADD COLUMN "categoriaId" TEXT;

-- Backfill: una Categoria de nivel raíz por cada valor distinto no nulo de
-- productos.categoria (por tenant), preservando la categorización existente.
INSERT INTO "categorias" ("id", "tenantId", "nombre", "categoriaPadreId", "activa", "createdAt")
SELECT gen_random_uuid(), t."tenantId", t."categoria", NULL, true, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "tenantId", "categoria" FROM "productos" WHERE "categoria" IS NOT NULL) t;

UPDATE "productos" p
SET "categoriaId" = c."id"
FROM "categorias" c
WHERE p."categoria" IS NOT NULL
  AND c."tenantId" = p."tenantId"
  AND c."nombre" = p."categoria";

-- AlterTable: ya migrados todos los valores, se puede dropear la columna vieja.
ALTER TABLE "productos" DROP COLUMN "categoria";

-- CreateIndex
CREATE UNIQUE INDEX "categorias_tenantId_nombre_key" ON "categorias"("tenantId", "nombre");

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_categoriaPadreId_fkey" FOREIGN KEY ("categoriaPadreId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
