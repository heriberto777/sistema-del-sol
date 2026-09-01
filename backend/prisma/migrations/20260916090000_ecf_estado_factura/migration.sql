-- Ítem "e-CF real" (pieza 2) — estado real de la DGII en cada Factura

-- CreateEnum
CREATE TYPE "EstadoECf" AS ENUM ('ACEPTADO', 'ACEPTADO_CONDICIONAL', 'RECHAZADO', 'EN_PROCESO');

-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "eCfEstado" "EstadoECf",
ADD COLUMN     "eCfIdExterno" TEXT,
ADD COLUMN     "eCfMensajeError" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "facturas_eCfIdExterno_key" ON "facturas"("eCfIdExterno");
