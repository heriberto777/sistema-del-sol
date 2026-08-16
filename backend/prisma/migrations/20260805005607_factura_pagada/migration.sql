-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "fechaPago" TIMESTAMP(3),
ADD COLUMN     "pagada" BOOLEAN NOT NULL DEFAULT false;
