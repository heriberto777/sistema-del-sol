-- ListaPrecio: catálogo de niveles de precio por tenant (Fase 3b de
-- adopción de Cuadre). Precio.listaPrecio sigue siendo un String libre
-- sin FK — este catálogo solo alimenta selectores de UI. Se siembra con
-- los mismos 4 valores que TenantsRepository.crearConProvisioning
-- sembrará para los tenants nuevos (ver listas-precio-base.ts), con
-- "GENERAL" en mayúsculas para calzar exacto con el default histórico
-- de Precio.listaPrecio.

-- CreateTable
CREATE TABLE "listas_precio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listas_precio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "listas_precio_tenantId_nombre_key" ON "listas_precio"("tenantId", "nombre");

ALTER TABLE "listas_precio" ADD CONSTRAINT "listas_precio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sembrar el catálogo de fábrica para cada tenant ya existente.
INSERT INTO "listas_precio" ("id", "tenantId", "nombre", "activa")
SELECT gen_random_uuid(), t."id", v."nombre", true
FROM "tenants" t
CROSS JOIN (VALUES
    ('GENERAL'),
    ('Mayorista'),
    ('Distribuidor'),
    ('Especial')
) AS v("nombre");

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "listaPrecioId" TEXT;

ALTER TABLE "clientes" ADD CONSTRAINT "clientes_listaPrecioId_fkey" FOREIGN KEY ("listaPrecioId") REFERENCES "listas_precio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
