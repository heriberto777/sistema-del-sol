-- CreateEnum
CREATE TYPE "TipoGestionCobro" AS ENUM ('LLAMADA', 'EMAIL', 'WHATSAPP', 'VISITA', 'PROMESA_PAGO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoProvisionIncobrable" AS ENUM ('PROVISIONADA', 'CASTIGADA');

-- AlterEnum
ALTER TYPE "EstadoCxC" ADD VALUE 'CASTIGADA';

-- AlterEnum
ALTER TYPE "OrigenAsiento" ADD VALUE 'INCOBRABLE';

-- CreateTable
CREATE TABLE "gestiones_cobro" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "cuentaPorCobrarId" TEXT,
    "tipo" "TipoGestionCobro" NOT NULL,
    "resultado" TEXT NOT NULL,
    "promesaFecha" TIMESTAMP(3),
    "promesaMonto" DECIMAL(14,2),
    "proximaAccion" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gestiones_cobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provisiones_incobrables" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cuentaPorCobrarId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoProvisionIncobrable" NOT NULL DEFAULT 'PROVISIONADA',
    "userId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCastigo" TIMESTAMP(3),

    CONSTRAINT "provisiones_incobrables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gestiones_cobro_tenantId_clienteId_idx" ON "gestiones_cobro"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "gestiones_cobro_cuentaPorCobrarId_idx" ON "gestiones_cobro"("cuentaPorCobrarId");

-- CreateIndex
CREATE UNIQUE INDEX "provisiones_incobrables_cuentaPorCobrarId_key" ON "provisiones_incobrables"("cuentaPorCobrarId");

-- AddForeignKey
ALTER TABLE "gestiones_cobro" ADD CONSTRAINT "gestiones_cobro_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestiones_cobro" ADD CONSTRAINT "gestiones_cobro_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestiones_cobro" ADD CONSTRAINT "gestiones_cobro_cuentaPorCobrarId_fkey" FOREIGN KEY ("cuentaPorCobrarId") REFERENCES "cuentas_por_cobrar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestiones_cobro" ADD CONSTRAINT "gestiones_cobro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisiones_incobrables" ADD CONSTRAINT "provisiones_incobrables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisiones_incobrables" ADD CONSTRAINT "provisiones_incobrables_cuentaPorCobrarId_fkey" FOREIGN KEY ("cuentaPorCobrarId") REFERENCES "cuentas_por_cobrar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisiones_incobrables" ADD CONSTRAINT "provisiones_incobrables_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
