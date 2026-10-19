-- AlterTable
ALTER TABLE "lineas_venta_aparcada" ADD COLUMN     "unidadMedidaId" TEXT;

-- AddForeignKey
ALTER TABLE "lineas_venta_aparcada" ADD CONSTRAINT "lineas_venta_aparcada_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;
