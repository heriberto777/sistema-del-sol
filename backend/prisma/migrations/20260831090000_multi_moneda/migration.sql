-- AlterTable
ALTER TABLE "facturas" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'DOP';
ALTER TABLE "facturas" ADD COLUMN "tasaCambio" DECIMAL(14,6);
ALTER TABLE "facturas" ADD COLUMN "subtotalMoneda" DECIMAL(14,2);
ALTER TABLE "facturas" ADD COLUMN "itbisMoneda" DECIMAL(14,2);
ALTER TABLE "facturas" ADD COLUMN "totalMoneda" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "tasas_cambio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moneda" TEXT NOT NULL,
    "tasa" DECIMAL(14,6) NOT NULL,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasas_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tasas_cambio_tenantId_moneda_key" ON "tasas_cambio"("tenantId", "moneda");

-- AddForeignKey
ALTER TABLE "tasas_cambio" ADD CONSTRAINT "tasas_cambio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
