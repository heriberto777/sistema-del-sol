-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "logo" TEXT;

-- Backfill: el logo vivía en Configuracion[DOCUMENTO_LOGO] (tenant-scoped)
UPDATE "tenants" t SET "logo" = c."valor"
  FROM "configuraciones" c
  WHERE c."tenantId" = t.id AND c."clave" = 'DOCUMENTO_LOGO' AND c."valor" != '';

-- Cutover limpio: una sola fuente de verdad de ahora en más (Tenant.logo)
DELETE FROM "configuraciones" WHERE "clave" = 'DOCUMENTO_LOGO';
