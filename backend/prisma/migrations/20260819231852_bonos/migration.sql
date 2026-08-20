-- CreateEnum
CREATE TYPE "EstadoBono" AS ENUM ('ACTIVO', 'AGOTADO', 'VENCIDO', 'ANULADO');

-- AlterTable
ALTER TABLE "formas_pago" ADD COLUMN     "esBono" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "bonos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "montoInicial" DECIMAL(14,2) NOT NULL,
    "saldoActual" DECIMAL(14,2) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoBono" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bonos_tenantId_codigo_key" ON "bonos"("tenantId", "codigo");

-- AddForeignKey
ALTER TABLE "bonos" ADD CONSTRAINT "bonos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
