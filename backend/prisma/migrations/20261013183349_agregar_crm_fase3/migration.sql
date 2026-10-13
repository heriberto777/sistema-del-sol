-- AlterTable
ALTER TABLE "crm_actividades" ADD COLUMN     "avisoEnviado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "crm_metas_venta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "montoMeta" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_metas_venta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_metas_venta_tenantId_vendedorId_anio_mes_key" ON "crm_metas_venta"("tenantId", "vendedorId", "anio", "mes");

-- AddForeignKey
ALTER TABLE "crm_metas_venta" ADD CONSTRAINT "crm_metas_venta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_metas_venta" ADD CONSTRAINT "crm_metas_venta_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
