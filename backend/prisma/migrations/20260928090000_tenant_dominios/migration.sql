-- CreateEnum
CREATE TYPE "EstadoDominioTenant" AS ENUM ('PENDIENTE', 'VERIFICANDO', 'ACTIVO', 'ERROR');

-- CreateTable
CREATE TABLE "tenant_dominios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "estado" "EstadoDominioTenant" NOT NULL DEFAULT 'PENDIENTE',
    "mensajeError" TEXT,
    "npmProxyHostId" INTEGER,
    "npmCertificadoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activadoEn" TIMESTAMP(3),

    CONSTRAINT "tenant_dominios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_dominios_dominio_key" ON "tenant_dominios"("dominio");

-- AddForeignKey
ALTER TABLE "tenant_dominios" ADD CONSTRAINT "tenant_dominios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "plataforma_configuracion" ADD COLUMN "npmBaseUrl" TEXT,
ADD COLUMN "npmUsuario" TEXT,
ADD COLUMN "npmPasswordCifrado" TEXT,
ADD COLUMN "npmForwardHost" TEXT,
ADD COLUMN "npmForwardPort" INTEGER;
