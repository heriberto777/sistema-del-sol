-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "cuentaCostoId" TEXT,
ADD COLUMN     "cuentaIngresoId" TEXT;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_cuentaIngresoId_fkey" FOREIGN KEY ("cuentaIngresoId") REFERENCES "cuentas_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_cuentaCostoId_fkey" FOREIGN KEY ("cuentaCostoId") REFERENCES "cuentas_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
