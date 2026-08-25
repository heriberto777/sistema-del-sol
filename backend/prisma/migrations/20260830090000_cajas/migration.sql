-- CreateTable
CREATE TABLE "cajas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bodegaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_categorias" (
    "id" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,

    CONSTRAINT "caja_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_productos" (
    "id" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,

    CONSTRAINT "caja_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_producto_favoritos" (
    "id" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,

    CONSTRAINT "caja_producto_favoritos_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "turnos_caja" ADD COLUMN "cajaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "cajas_tenantId_codigo_key" ON "cajas"("tenantId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "caja_categorias_cajaId_categoriaId_key" ON "caja_categorias"("cajaId", "categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "caja_productos_cajaId_productoId_key" ON "caja_productos"("cajaId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "caja_producto_favoritos_cajaId_productoId_key" ON "caja_producto_favoritos"("cajaId", "productoId");

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_categorias" ADD CONSTRAINT "caja_categorias_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_categorias" ADD CONSTRAINT "caja_categorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_productos" ADD CONSTRAINT "caja_productos_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_productos" ADD CONSTRAINT "caja_productos_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_producto_favoritos" ADD CONSTRAINT "caja_producto_favoritos_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_producto_favoritos" ADD CONSTRAINT "caja_producto_favoritos_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turno_caja_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
