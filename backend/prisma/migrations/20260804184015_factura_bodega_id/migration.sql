-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "bodegaId" TEXT;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
