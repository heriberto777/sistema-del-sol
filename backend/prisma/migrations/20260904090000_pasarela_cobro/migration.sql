-- DropForeignKey
ALTER TABLE "pagos" DROP CONSTRAINT "pagos_userId_fkey";

-- AlterTable
ALTER TABLE "pagos" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "pasarela_config_tenant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pasarelaActiva" TEXT,
    "azulMerchantId" TEXT,
    "azulMerchantName" TEXT,
    "azulAuth1Cifrado" TEXT,
    "azulAuth2Cifrado" TEXT,
    "cardnetMerchantNumber" TEXT,
    "cardnetMerchantTerminal" TEXT,
    "cardnetMerchantName" TEXT,
    "cardnetAuthKeyCifrado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pasarela_config_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_cobro_factura" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "pasarela" TEXT NOT NULL,
    "referenciaExterna" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "datosVerificacion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "pagoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sesiones_cobro_factura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pasarela_config_tenant_tenantId_key" ON "pasarela_config_tenant"("tenantId");

-- CreateIndex
CREATE INDEX "sesiones_cobro_factura_facturaId_idx" ON "sesiones_cobro_factura"("facturaId");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_cobro_factura_pasarela_referenciaExterna_key" ON "sesiones_cobro_factura"("pasarela", "referenciaExterna");

-- AddForeignKey
ALTER TABLE "pasarela_config_tenant" ADD CONSTRAINT "pasarela_config_tenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_cobro_factura" ADD CONSTRAINT "sesiones_cobro_factura_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
