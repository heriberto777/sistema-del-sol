-- AlterTable: "pagoId" se mantiene por ahora (no se dropea todavía) — el
-- backfill de más abajo lo necesita para mapear cada Pago histórico a su
-- ReciboIngreso nuevo. Se dropea en la migración de limpieza, junto con la
-- tabla "pagos", una vez verificado (ver backend/scripts/backfill-pagos-historicos.ts).
ALTER TABLE "sesiones_cobro_factura" ADD COLUMN "reciboIngresoId" TEXT;

-- CreateTable
CREATE TABLE "recibos_ingreso" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "formaPagoId" TEXT NOT NULL,
    "referencia" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recibos_ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicaciones_cobro" (
    "id" TEXT NOT NULL,
    "reciboIngresoId" TEXT NOT NULL,
    "cuentaPorCobrarId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aplicaciones_cobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_pago" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "retencionIsr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "retencionItbis" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "formaPagoId" TEXT NOT NULL,
    "referencia" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicaciones_pago" (
    "id" TEXT NOT NULL,
    "ordenPagoId" TEXT NOT NULL,
    "cuentaPorPagarId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aplicaciones_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recibos_ingreso_tenantId_clienteId_idx" ON "recibos_ingreso"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "aplicaciones_cobro_facturaId_idx" ON "aplicaciones_cobro"("facturaId");

-- CreateIndex
CREATE INDEX "ordenes_pago_tenantId_proveedorId_idx" ON "ordenes_pago"("tenantId", "proveedorId");

-- AddForeignKey
ALTER TABLE "recibos_ingreso" ADD CONSTRAINT "recibos_ingreso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos_ingreso" ADD CONSTRAINT "recibos_ingreso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos_ingreso" ADD CONSTRAINT "recibos_ingreso_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos_ingreso" ADD CONSTRAINT "recibos_ingreso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_cobro" ADD CONSTRAINT "aplicaciones_cobro_reciboIngresoId_fkey" FOREIGN KEY ("reciboIngresoId") REFERENCES "recibos_ingreso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_cobro" ADD CONSTRAINT "aplicaciones_cobro_cuentaPorCobrarId_fkey" FOREIGN KEY ("cuentaPorCobrarId") REFERENCES "cuentas_por_cobrar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_cobro" ADD CONSTRAINT "aplicaciones_cobro_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_pago" ADD CONSTRAINT "ordenes_pago_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_pago" ADD CONSTRAINT "ordenes_pago_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_pago" ADD CONSTRAINT "ordenes_pago_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_pago" ADD CONSTRAINT "ordenes_pago_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_pago" ADD CONSTRAINT "aplicaciones_pago_ordenPagoId_fkey" FOREIGN KEY ("ordenPagoId") REFERENCES "ordenes_pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicaciones_pago" ADD CONSTRAINT "aplicaciones_pago_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "cuentas_por_pagar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
