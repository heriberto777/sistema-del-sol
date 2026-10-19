-- AlterTable
ALTER TABLE "linea_oc" ADD COLUMN     "factorConversion" DECIMAL(14,4) NOT NULL DEFAULT 1,
ADD COLUMN     "unidadMedidaId" TEXT;

-- AlterTable
ALTER TABLE "linea_recepcion" ADD COLUMN     "factorConversion" DECIMAL(14,4) NOT NULL DEFAULT 1,
ADD COLUMN     "unidadMedidaId" TEXT;

-- AddForeignKey
ALTER TABLE "linea_oc" ADD CONSTRAINT "linea_oc_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_recepcion" ADD CONSTRAINT "linea_recepcion_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;
