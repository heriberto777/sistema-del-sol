-- Ítem "e-CF real" (pieza 3) — estado real de la DGII en cada FacturaPlataforma

ALTER TABLE "facturas_plataforma" ADD COLUMN     "eCfEstado" "EstadoECf",
ADD COLUMN     "eCfIdExterno" TEXT,
ADD COLUMN     "eCfMensajeError" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "facturas_plataforma_eCfIdExterno_key" ON "facturas_plataforma"("eCfIdExterno");
