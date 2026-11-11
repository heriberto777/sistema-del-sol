-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "terminoPagoId" TEXT;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_terminoPagoId_fkey" FOREIGN KEY ("terminoPagoId") REFERENCES "terminos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

