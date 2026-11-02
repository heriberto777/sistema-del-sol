-- CreateEnum
CREATE TYPE "EstadoCxP" AS ENUM ('ABIERTA', 'PARCIAL', 'PAGADA', 'ANULADA');

-- CreateTable
CREATE TABLE "cuentas_por_pagar" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "recepcionCompraId" TEXT NOT NULL,
    "terminoPagoId" TEXT,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "saldo" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCxP" NOT NULL DEFAULT 'ABIERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_por_pagar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_por_pagar_recepcionCompraId_key" ON "cuentas_por_pagar"("recepcionCompraId");

-- CreateIndex
CREATE INDEX "cuentas_por_pagar_tenantId_proveedorId_idx" ON "cuentas_por_pagar"("tenantId", "proveedorId");

-- CreateIndex
CREATE INDEX "cuentas_por_pagar_tenantId_estado_idx" ON "cuentas_por_pagar"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "cuentas_por_pagar_tenantId_ordenCompraId_idx" ON "cuentas_por_pagar"("tenantId", "ordenCompraId");

-- AddForeignKey
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "orden_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_recepcionCompraId_fkey" FOREIGN KEY ("recepcionCompraId") REFERENCES "recepcion_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_terminoPagoId_fkey" FOREIGN KEY ("terminoPagoId") REFERENCES "terminos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
