-- CreateEnum
CREATE TYPE "TipoCuentaBancaria" AS ENUM ('CORRIENTE', 'AHORROS');

-- AlterEnum
ALTER TYPE "OrigenAsiento" ADD VALUE 'GASTO_MENOR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNcf" ADD VALUE 'B11';
ALTER TYPE "TipoNcf" ADD VALUE 'E43';

-- CreateTable
CREATE TABLE "cuentas_bancarias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "numeroCuenta" TEXT NOT NULL,
    "tipoCuenta" "TipoCuentaBancaria" NOT NULL,
    "cuentaContableId" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos_menores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ncf" TEXT,
    "tipoNcf" "TipoNcf",
    "notas" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cuentaBancariaId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "itbis" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_menores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineas_gasto_menor" (
    "id" TEXT NOT NULL,
    "gastoMenorId" TEXT NOT NULL,
    "cuentaContableId" TEXT NOT NULL,
    "concepto" TEXT,
    "valor" DECIMAL(14,2) NOT NULL,
    "porcentajeItbis" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "montoItbis" DECIMAL(14,2) NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "montoTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "lineas_gasto_menor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_bancarias_tenantId_numeroCuenta_key" ON "cuentas_bancarias"("tenantId", "numeroCuenta");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_menores_tenantId_ncf_key" ON "gastos_menores"("tenantId", "ncf");

-- AddForeignKey
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_cuentaContableId_fkey" FOREIGN KEY ("cuentaContableId") REFERENCES "cuentas_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_menores" ADD CONSTRAINT "gastos_menores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_menores" ADD CONSTRAINT "gastos_menores_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "cuentas_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_gasto_menor" ADD CONSTRAINT "lineas_gasto_menor_gastoMenorId_fkey" FOREIGN KEY ("gastoMenorId") REFERENCES "gastos_menores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_gasto_menor" ADD CONSTRAINT "lineas_gasto_menor_cuentaContableId_fkey" FOREIGN KEY ("cuentaContableId") REFERENCES "cuentas_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
