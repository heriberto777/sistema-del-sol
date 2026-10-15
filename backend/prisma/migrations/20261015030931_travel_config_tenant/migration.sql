/*
  Warnings:

  - You are about to drop the column `duffelApiTokenCifrado` on the `plataforma_configuracion` table. All the data in the column will be lost.
  - You are about to drop the column `duffelWebhookSecretCifrado` on the `plataforma_configuracion` table. All the data in the column will be lost.
  - You are about to drop the column `hotelbedsApiKeyCifrado` on the `plataforma_configuracion` table. All the data in the column will be lost.
  - You are about to drop the column `hotelbedsMoneda` on the `plataforma_configuracion` table. All the data in the column will be lost.
  - You are about to drop the column `hotelbedsSecretCifrado` on the `plataforma_configuracion` table. All the data in the column will be lost.
  - You are about to drop the column `hotelbedsTasaCambio` on the `plataforma_configuracion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "plataforma_configuracion" DROP COLUMN "duffelApiTokenCifrado",
DROP COLUMN "duffelWebhookSecretCifrado",
DROP COLUMN "hotelbedsApiKeyCifrado",
DROP COLUMN "hotelbedsMoneda",
DROP COLUMN "hotelbedsSecretCifrado",
DROP COLUMN "hotelbedsTasaCambio";

-- CreateTable
CREATE TABLE "travel_config_tenant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "duffelApiTokenCifrado" TEXT,
    "duffelWebhookSecretCifrado" TEXT,
    "hotelbedsApiKeyCifrado" TEXT,
    "hotelbedsSecretCifrado" TEXT,
    "hotelbedsMoneda" TEXT,
    "hotelbedsTasaCambio" DECIMAL(12,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_config_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "travel_config_tenant_tenantId_key" ON "travel_config_tenant"("tenantId");

-- AddForeignKey
ALTER TABLE "travel_config_tenant" ADD CONSTRAINT "travel_config_tenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
