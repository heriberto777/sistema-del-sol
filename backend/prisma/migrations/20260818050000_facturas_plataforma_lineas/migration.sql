-- CreateTable
CREATE TABLE "facturas_plataforma_lineas" (
    "id" TEXT NOT NULL,
    "facturaPlataformaId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturas_plataforma_lineas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "facturas_plataforma_lineas" ADD CONSTRAINT "facturas_plataforma_lineas_facturaPlataformaId_fkey" FOREIGN KEY ("facturaPlataformaId") REFERENCES "facturas_plataforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
