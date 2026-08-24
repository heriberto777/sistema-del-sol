-- AlterTable
ALTER TABLE "productos" ADD COLUMN "porcentajeComision" DECIMAL(5,2);
ALTER TABLE "productos" ADD COLUMN "montoComisionFijo" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "linea_factura" ADD COLUMN "pagaComision" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "comisiones_venta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "lineaFacturaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comisiones_venta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comisiones_venta_facturaId_lineaFacturaId_key" ON "comisiones_venta"("facturaId", "lineaFacturaId");

-- CreateIndex
CREATE INDEX "comisiones_venta_tenantId_empleadoId_idx" ON "comisiones_venta"("tenantId", "empleadoId");

-- CreateIndex
CREATE INDEX "comisiones_venta_tenantId_productoId_idx" ON "comisiones_venta"("tenantId", "productoId");

-- AddForeignKey
ALTER TABLE "comisiones_venta" ADD CONSTRAINT "comisiones_venta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones_venta" ADD CONSTRAINT "comisiones_venta_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones_venta" ADD CONSTRAINT "comisiones_venta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones_venta" ADD CONSTRAINT "comisiones_venta_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
