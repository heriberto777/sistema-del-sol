-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrigenAsiento" ADD VALUE 'PAGO';
ALTER TYPE "OrigenAsiento" ADD VALUE 'GASTO';

-- AlterTable
ALTER TABLE "orden_compra" ADD COLUMN     "fechaPago" TIMESTAMP(3),
ADD COLUMN     "pagada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facturaId" TEXT,
    "ordenCompraId" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagos_facturaId_idx" ON "pagos"("facturaId");

-- CreateIndex
CREATE INDEX "pagos_ordenCompraId_idx" ON "pagos"("ordenCompraId");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "orden_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
