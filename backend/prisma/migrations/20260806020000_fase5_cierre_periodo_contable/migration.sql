-- AlterEnum
ALTER TYPE "OrigenAsiento" ADD VALUE 'CIERRE';

-- CreateTable
CREATE TABLE "periodos_contables_cerrados" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "utilidadNeta" DECIMAL(14,2) NOT NULL,
    "asientoCierreId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_contables_cerrados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "periodos_contables_cerrados_asientoCierreId_key" ON "periodos_contables_cerrados"("asientoCierreId");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_contables_cerrados_tenantId_fecha_key" ON "periodos_contables_cerrados"("tenantId", "fecha");

-- AddForeignKey
ALTER TABLE "periodos_contables_cerrados" ADD CONSTRAINT "periodos_contables_cerrados_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_contables_cerrados" ADD CONSTRAINT "periodos_contables_cerrados_asientoCierreId_fkey" FOREIGN KEY ("asientoCierreId") REFERENCES "asientos_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
