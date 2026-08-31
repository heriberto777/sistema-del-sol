-- CreateEnum
CREATE TYPE "EstadoTransferenciaInventario" AS ENUM ('BORRADOR', 'CONFIRMADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "transferencia_inventario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "bodegaOrigenId" TEXT NOT NULL,
    "bodegaDestinoId" TEXT NOT NULL,
    "estado" "EstadoTransferenciaInventario" NOT NULL DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transferencia_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linea_transferencia_inventario" (
    "id" TEXT NOT NULL,
    "transferenciaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "linea_transferencia_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transferencia_inventario_tenantId_numero_key" ON "transferencia_inventario"("tenantId", "numero");

-- AddForeignKey
ALTER TABLE "transferencia_inventario" ADD CONSTRAINT "transferencia_inventario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencia_inventario" ADD CONSTRAINT "transferencia_inventario_bodegaOrigenId_fkey" FOREIGN KEY ("bodegaOrigenId") REFERENCES "bodegas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencia_inventario" ADD CONSTRAINT "transferencia_inventario_bodegaDestinoId_fkey" FOREIGN KEY ("bodegaDestinoId") REFERENCES "bodegas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencia_inventario" ADD CONSTRAINT "transferencia_inventario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_transferencia_inventario" ADD CONSTRAINT "linea_transferencia_inventario_transferenciaId_fkey" FOREIGN KEY ("transferenciaId") REFERENCES "transferencia_inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_transferencia_inventario" ADD CONSTRAINT "linea_transferencia_inventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_transferencia_inventario" ADD CONSTRAINT "linea_transferencia_inventario_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
