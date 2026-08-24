-- CreateTable
CREATE TABLE "leyes_fiscales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentajeItbisAPagar" DECIMAL(5,2) NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leyes_fiscales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leyes_fiscales_tenantId_codigo_key" ON "leyes_fiscales"("tenantId", "codigo");

-- AlterTable
ALTER TABLE "productos" ADD COLUMN "leyFiscalId" TEXT;

-- AddForeignKey
ALTER TABLE "leyes_fiscales" ADD CONSTRAINT "leyes_fiscales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_leyFiscalId_fkey" FOREIGN KEY ("leyFiscalId") REFERENCES "leyes_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
