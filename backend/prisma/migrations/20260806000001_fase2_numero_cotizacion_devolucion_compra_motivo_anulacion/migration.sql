-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "numero" TEXT;

-- Backfill: la única fila preexistente (sembrada antes de este cambio) no
-- tenía número — se le asigna uno placeholder legible antes de exigir NOT
-- NULL. Cotizaciones nuevas siempre lo traen desde el DTO.
UPDATE "cotizaciones" SET "numero" = 'COT-LEGACY-' || substr("id", 1, 8) WHERE "numero" IS NULL;

ALTER TABLE "cotizaciones" ALTER COLUMN "numero" SET NOT NULL;

-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "motivoAnulacion" TEXT;

-- CreateTable
CREATE TABLE "devolucion_compra" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "bodegaId" TEXT NOT NULL,
    "motivo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devolucion_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linea_devolucion_compra" (
    "id" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL,
    "costoUnitario" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "linea_devolucion_compra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_tenantId_numero_key" ON "cotizaciones"("tenantId", "numero");

-- AddForeignKey
ALTER TABLE "devolucion_compra" ADD CONSTRAINT "devolucion_compra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "orden_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_compra" ADD CONSTRAINT "devolucion_compra_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_devolucion_compra" ADD CONSTRAINT "linea_devolucion_compra_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devolucion_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_devolucion_compra" ADD CONSTRAINT "linea_devolucion_compra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
