-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "vendedorEmpleadoId" TEXT;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_vendedorEmpleadoId_fkey" FOREIGN KEY ("vendedorEmpleadoId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
