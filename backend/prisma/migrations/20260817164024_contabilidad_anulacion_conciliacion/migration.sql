-- AlterEnum
ALTER TYPE "OrigenAsiento" ADD VALUE 'ANULACION';

-- AlterTable
ALTER TABLE "lineas_asiento" ADD COLUMN     "conciliado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "conciliadoEn" TIMESTAMP(3);
