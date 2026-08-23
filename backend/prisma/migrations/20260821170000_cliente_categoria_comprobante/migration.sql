-- CreateEnum
CREATE TYPE "ComprobantePorDefecto" AS ENUM ('CONTADO', 'CREDITO', 'REGIMEN_ESPECIAL', 'GUBERNAMENTAL');

-- CreateTable
CREATE TABLE "categorias_cliente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_cliente_tenantId_nombre_key" ON "categorias_cliente"("tenantId", "nombre");

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "categoriaId" TEXT;
ALTER TABLE "clientes" ADD COLUMN "comprobantePorDefecto" "ComprobantePorDefecto";

-- AddForeignKey
ALTER TABLE "categorias_cliente" ADD CONSTRAINT "categorias_cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
