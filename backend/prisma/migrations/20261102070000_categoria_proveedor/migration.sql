-- AlterTable
ALTER TABLE "proveedores" ADD COLUMN     "categoriaId" TEXT;

-- CreateTable
CREATE TABLE "categorias_proveedor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_proveedor_tenantId_nombre_key" ON "categorias_proveedor"("tenantId", "nombre");

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_proveedor" ADD CONSTRAINT "categorias_proveedor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

