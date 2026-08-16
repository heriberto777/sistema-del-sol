-- DropForeignKey
ALTER TABLE "recepcion_compra" DROP CONSTRAINT "recepcion_compra_ordenCompraId_fkey";

-- AddForeignKey
ALTER TABLE "recepcion_compra" ADD CONSTRAINT "recepcion_compra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "orden_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
