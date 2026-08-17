-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "retencionIsr" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "retencionItbis" DECIMAL(14,2) NOT NULL DEFAULT 0;
