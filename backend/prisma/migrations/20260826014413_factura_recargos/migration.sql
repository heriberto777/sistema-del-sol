-- CreateTable
CREATE TABLE "factura_recargos" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "gravado" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "factura_recargos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "factura_recargos" ADD CONSTRAINT "factura_recargos_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
