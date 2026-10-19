-- AlterTable
ALTER TABLE "linea_cotizacion" ADD COLUMN     "unidadMedidaId" TEXT;

-- AlterTable
ALTER TABLE "linea_factura" ADD COLUMN     "factorConversion" DECIMAL(14,4) NOT NULL DEFAULT 1,
ADD COLUMN     "unidadMedidaId" TEXT;

-- AlterTable
ALTER TABLE "linea_remision" ADD COLUMN     "factorConversion" DECIMAL(14,4) NOT NULL DEFAULT 1,
ADD COLUMN     "unidadMedidaId" TEXT;

-- AddForeignKey
ALTER TABLE "linea_factura" ADD CONSTRAINT "linea_factura_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_cotizacion" ADD CONSTRAINT "linea_cotizacion_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_remision" ADD CONSTRAINT "linea_remision_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;
