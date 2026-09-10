-- CreateEnum
CREATE TYPE "EstadoCobroAlquiler" AS ENUM ('PENDIENTE', 'COBRADO', 'LIQUIDADO');

-- AlterTable
ALTER TABLE "contratos_propiedad" ADD COLUMN     "administracionActiva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "porcentajeComisionAdministracion" DECIMAL(5,2),
ADD COLUMN     "proximoCobroAlquilerEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "propiedades" ADD COLUMN     "propietarioId" TEXT;

-- CreateTable
CREATE TABLE "cobros_alquiler" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contratoPropiedadId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "montoAlquiler" DECIMAL(14,2) NOT NULL,
    "porcentajeComisionAdmin" DECIMAL(5,2),
    "montoComisionAdmin" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "montoPropietario" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoCobroAlquiler" NOT NULL DEFAULT 'PENDIENTE',
    "facturaId" TEXT,
    "fechaCobro" TIMESTAMP(3),
    "fechaLiquidacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cobros_alquiler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cobros_alquiler_facturaId_key" ON "cobros_alquiler"("facturaId");

-- CreateIndex
CREATE UNIQUE INDEX "cobros_alquiler_contratoPropiedadId_periodo_key" ON "cobros_alquiler"("contratoPropiedadId", "periodo");

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_alquiler" ADD CONSTRAINT "cobros_alquiler_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_alquiler" ADD CONSTRAINT "cobros_alquiler_contratoPropiedadId_fkey" FOREIGN KEY ("contratoPropiedadId") REFERENCES "contratos_propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_alquiler" ADD CONSTRAINT "cobros_alquiler_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
