-- DropForeignKey
ALTER TABLE "linea_oc" DROP CONSTRAINT "linea_oc_productoId_fkey";

-- DropForeignKey
ALTER TABLE "linea_recepcion" DROP CONSTRAINT "linea_recepcion_productoId_fkey";

-- AddForeignKey
ALTER TABLE "linea_oc" ADD CONSTRAINT "linea_oc_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_recepcion" ADD CONSTRAINT "linea_recepcion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
