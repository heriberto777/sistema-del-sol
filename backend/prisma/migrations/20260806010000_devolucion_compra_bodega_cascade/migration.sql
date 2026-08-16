-- DropForeignKey
ALTER TABLE "devolucion_compra" DROP CONSTRAINT "devolucion_compra_bodegaId_fkey";

-- AddForeignKey
ALTER TABLE "devolucion_compra" ADD CONSTRAINT "devolucion_compra_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
