-- CreateEnum
CREATE TYPE "TipoUsoIa" AS ENUM ('IMAGEN_PRODUCTO', 'ASISTENTE');

-- AlterTable
ALTER TABLE "plataforma_configuracion" ADD COLUMN     "iaAsistenteLimiteMensual" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "iaImagenLimiteMensual" INTEGER NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE "usos_ia_tenant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoUsoIa" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usos_ia_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usos_ia_tenant_tenantId_tipo_createdAt_idx" ON "usos_ia_tenant"("tenantId", "tipo", "createdAt");

-- AddForeignKey
ALTER TABLE "usos_ia_tenant" ADD CONSTRAINT "usos_ia_tenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
