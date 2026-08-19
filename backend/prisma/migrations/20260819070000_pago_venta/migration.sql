-- CreateTable
CREATE TABLE "pagos_venta" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "formaPagoId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "referencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_venta_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: toda factura de POS ya emitida (formaPagoId + turnoCajaId no
-- nulos, ver Fase 1/Fase 2b) sin PagoVenta propio pasa a tener uno con el
-- monto total de la factura — para que calcularMovimientoEfectivo (que a
-- partir de ahora suma solo desde pagos_venta) no pierda el efectivo de
-- turnos que ya estaban abiertos con ventas anteriores a esta migración.
INSERT INTO "pagos_venta" ("id", "facturaId", "formaPagoId", "monto", "referencia", "createdAt")
SELECT gen_random_uuid(), f."id", f."formaPagoId", f."total", f."referenciaPago", f."createdAt"
FROM "facturas" f
WHERE f."formaPagoId" IS NOT NULL
  AND f."turnoCajaId" IS NOT NULL;
