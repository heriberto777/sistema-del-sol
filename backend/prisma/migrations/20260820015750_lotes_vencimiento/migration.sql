-- AlterTable
ALTER TABLE "movimiento_inventario" ADD COLUMN     "loteId" TEXT;

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "controlaVencimiento" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "lotes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "bodegaId" TEXT NOT NULL,
    "numeroLote" TEXT NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "cantidadActual" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lotes_tenantId_fechaVencimiento_idx" ON "lotes"("tenantId", "fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_tenantId_varianteId_bodegaId_numeroLote_key" ON "lotes"("tenantId", "varianteId", "bodegaId", "numeroLote");

-- CreateIndex
CREATE INDEX "movimiento_inventario_loteId_idx" ON "movimiento_inventario"("loteId");

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

