-- CreateEnum
CREATE TYPE "EstadoPeriodoContable" AS ENUM ('ABIERTO', 'CERRADO');

-- DropForeignKey
ALTER TABLE "periodos_contables_cerrados" DROP CONSTRAINT "periodos_contables_cerrados_asientoCierreId_fkey";

-- DropForeignKey
ALTER TABLE "periodos_contables_cerrados" DROP CONSTRAINT "periodos_contables_cerrados_tenantId_fkey";

-- DropTable
DROP TABLE "periodos_contables_cerrados";

-- CreateTable
CREATE TABLE "periodos_contables" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPeriodoContable" NOT NULL DEFAULT 'ABIERTO',
    "utilidadNeta" DECIMAL(14,2),
    "asientoCierreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_contables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "periodos_contables_asientoCierreId_key" ON "periodos_contables"("asientoCierreId");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_contables_tenantId_fechaInicio_key" ON "periodos_contables"("tenantId", "fechaInicio");

-- AddForeignKey
ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_asientoCierreId_fkey" FOREIGN KEY ("asientoCierreId") REFERENCES "asientos_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

