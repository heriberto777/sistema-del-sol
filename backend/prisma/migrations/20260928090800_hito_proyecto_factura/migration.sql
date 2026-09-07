-- AlterTable
ALTER TABLE "hitos_proyecto" ADD COLUMN     "facturaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "hitos_proyecto_facturaId_key" ON "hitos_proyecto"("facturaId");

-- AddForeignKey
ALTER TABLE "hitos_proyecto" ADD CONSTRAINT "hitos_proyecto_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
