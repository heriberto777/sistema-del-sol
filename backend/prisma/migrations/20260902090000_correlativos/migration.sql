-- CreateEnum
CREATE TYPE "TipoCorrelativo" AS ENUM ('COTIZACION', 'REMISION', 'ORDEN_COMPRA', 'CAJA', 'PRODUCTO', 'CUENTA_CONTABLE');

-- CreateTable
CREATE TABLE "correlativos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoCorrelativo" NOT NULL,
    "prefijo" TEXT NOT NULL DEFAULT '',
    "siguienteNumero" INTEGER NOT NULL DEFAULT 1,
    "digitos" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "correlativos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "correlativos_tenantId_tipo_key" ON "correlativos"("tenantId", "tipo");

-- AddForeignKey
ALTER TABLE "correlativos" ADD CONSTRAINT "correlativos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
