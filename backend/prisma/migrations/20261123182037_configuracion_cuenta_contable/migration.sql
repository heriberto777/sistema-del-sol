-- CreateTable
CREATE TABLE "configuraciones_cuenta_contable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "cuentaContableId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuraciones_cuenta_contable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuraciones_cuenta_contable_tenantId_clave_key" ON "configuraciones_cuenta_contable"("tenantId", "clave");

-- AddForeignKey
ALTER TABLE "configuraciones_cuenta_contable" ADD CONSTRAINT "configuraciones_cuenta_contable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuraciones_cuenta_contable" ADD CONSTRAINT "configuraciones_cuenta_contable_cuentaContableId_fkey" FOREIGN KEY ("cuentaContableId") REFERENCES "cuentas_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

