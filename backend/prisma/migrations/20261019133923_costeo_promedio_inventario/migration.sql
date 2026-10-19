-- AlterTable
ALTER TABLE "linea_factura" ADD COLUMN     "costoUnitario" DECIMAL(14,4);

-- AlterTable
ALTER TABLE "stock" ADD COLUMN     "costoPromedio" DECIMAL(14,4) NOT NULL DEFAULT 0;
