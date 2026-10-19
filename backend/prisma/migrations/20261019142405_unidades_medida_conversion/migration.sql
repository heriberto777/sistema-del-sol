-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "unidadMedidaBaseId" TEXT;

-- CreateTable
CREATE TABLE "unidades_medida" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidades_medida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_unidad_conversion" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "unidadMedidaId" TEXT NOT NULL,
    "factorConversion" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "producto_unidad_conversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unidades_medida_tenantId_codigo_key" ON "unidades_medida"("tenantId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "producto_unidad_conversion_productoId_unidadMedidaId_key" ON "producto_unidad_conversion"("productoId", "unidadMedidaId");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_unidadMedidaBaseId_fkey" FOREIGN KEY ("unidadMedidaBaseId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_medida" ADD CONSTRAINT "unidades_medida_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_unidad_conversion" ADD CONSTRAINT "producto_unidad_conversion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_unidad_conversion" ADD CONSTRAINT "producto_unidad_conversion_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "unidades_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
