-- CreateEnum
CREATE TYPE "EstadoAjusteInventario" AS ENUM ('BORRADOR', 'CONFIRMADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "ajuste_inventario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "bodegaId" TEXT NOT NULL,
    "estado" "EstadoAjusteInventario" NOT NULL DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajuste_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linea_ajuste_inventario" (
    "id" TEXT NOT NULL,
    "ajusteId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL,
    "motivoAjuste" "MotivoAjusteInventario",
    "motivo" TEXT,
    "numeroLote" TEXT,
    "fechaVencimiento" TIMESTAMP(3),
    "loteId" TEXT,

    CONSTRAINT "linea_ajuste_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ajuste_inventario_tenantId_numero_key" ON "ajuste_inventario"("tenantId", "numero");

-- AddForeignKey
ALTER TABLE "ajuste_inventario" ADD CONSTRAINT "ajuste_inventario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_inventario" ADD CONSTRAINT "ajuste_inventario_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_inventario" ADD CONSTRAINT "ajuste_inventario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_ajuste_inventario" ADD CONSTRAINT "linea_ajuste_inventario_ajusteId_fkey" FOREIGN KEY ("ajusteId") REFERENCES "ajuste_inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_ajuste_inventario" ADD CONSTRAINT "linea_ajuste_inventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_ajuste_inventario" ADD CONSTRAINT "linea_ajuste_inventario_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
