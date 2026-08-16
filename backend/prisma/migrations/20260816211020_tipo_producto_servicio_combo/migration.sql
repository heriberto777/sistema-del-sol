-- CreateEnum
CREATE TYPE "TipoProducto" AS ENUM ('PRODUCTO', 'SERVICIO', 'COMBO');

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "tipo" "TipoProducto" NOT NULL DEFAULT 'PRODUCTO';

-- CreateTable
CREATE TABLE "componentes_combo" (
    "id" TEXT NOT NULL,
    "comboId" TEXT NOT NULL,
    "componenteId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "componentes_combo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "componentes_combo_comboId_componenteId_key" ON "componentes_combo"("comboId", "componenteId");

-- AddForeignKey
ALTER TABLE "componentes_combo" ADD CONSTRAINT "componentes_combo_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "componentes_combo" ADD CONSTRAINT "componentes_combo_componenteId_fkey" FOREIGN KEY ("componenteId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
