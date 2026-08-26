-- AlterTable: número interno de Factura, nullable (facturas existentes
-- no lo tienen todavía — completar con `pnpm --filter ./backend
-- facturas:backfill-numero`, script separado, no bloqueante).
ALTER TABLE "facturas" ADD COLUMN "numero" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "facturas_tenantId_numero_key" ON "facturas"("tenantId", "numero");
