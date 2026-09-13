-- CreateTable
CREATE TABLE "travel_reglas_markup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoTravelReserva",
    "porcentaje" DECIMAL(5,2),
    "montoFijo" DECIMAL(12,2),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_reglas_markup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "travel_reglas_markup" ADD CONSTRAINT "travel_reglas_markup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
