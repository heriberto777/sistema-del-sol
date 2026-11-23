-- AlterTable
ALTER TABLE "ordenes_pago" ADD COLUMN     "cuentaBancariaId" TEXT;

-- AlterTable
ALTER TABLE "recibos_ingreso" ADD COLUMN     "cuentaBancariaId" TEXT;

-- AddForeignKey
ALTER TABLE "recibos_ingreso" ADD CONSTRAINT "recibos_ingreso_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "cuentas_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_pago" ADD CONSTRAINT "ordenes_pago_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "cuentas_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
