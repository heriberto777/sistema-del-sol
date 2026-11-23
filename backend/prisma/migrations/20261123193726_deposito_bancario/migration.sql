-- CreateEnum
CREATE TYPE "EstadoDepositoBancario" AS ENUM ('ABIERTO', 'ANULADO');

-- AlterEnum
ALTER TYPE "OrigenAsiento" ADD VALUE 'DEPOSITO';

-- AlterEnum
ALTER TYPE "TipoCorrelativo" ADD VALUE 'DEPOSITO_BANCARIO';

-- CreateTable
CREATE TABLE "depositos_bancarios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cuentaBancariaId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "numeroComprobante" TEXT,
    "bodegaId" TEXT,
    "notas" TEXT,
    "estado" "EstadoDepositoBancario" NOT NULL DEFAULT 'ABIERTO',
    "excedioSaldo" BOOLEAN NOT NULL DEFAULT false,
    "saldoDisponibleAlMomento" DECIMAL(14,2) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "depositos_bancarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "depositos_bancarios_tenantId_numero_key" ON "depositos_bancarios"("tenantId", "numero");

-- AddForeignKey
ALTER TABLE "depositos_bancarios" ADD CONSTRAINT "depositos_bancarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depositos_bancarios" ADD CONSTRAINT "depositos_bancarios_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "cuentas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depositos_bancarios" ADD CONSTRAINT "depositos_bancarios_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depositos_bancarios" ADD CONSTRAINT "depositos_bancarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

