-- DropForeignKey
ALTER TABLE "linea_cotizacion" DROP CONSTRAINT "linea_cotizacion_productoId_fkey";

-- DropForeignKey
ALTER TABLE "linea_remision" DROP CONSTRAINT "linea_remision_productoId_fkey";

-- AddForeignKey
ALTER TABLE "linea_cotizacion" ADD CONSTRAINT "linea_cotizacion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_remision" ADD CONSTRAINT "linea_remision_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
