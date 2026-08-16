-- DropForeignKey
ALTER TABLE "lineas_asiento" DROP CONSTRAINT "lineas_asiento_cuentaContableId_fkey";

-- AddForeignKey
ALTER TABLE "lineas_asiento" ADD CONSTRAINT "lineas_asiento_cuentaContableId_fkey" FOREIGN KEY ("cuentaContableId") REFERENCES "cuentas_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
