-- CreateTable
CREATE TABLE "whatsapp_config_tenant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "twilioAccountSid" TEXT,
    "twilioAuthTokenCifrado" TEXT,
    "twilioWhatsappFrom" TEXT,
    "iaProveedor" TEXT,
    "iaModelo" TEXT,
    "iaApiKeyCifrado" TEXT,
    "historialMensajes" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_config_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_config_tenant_tenantId_key" ON "whatsapp_config_tenant"("tenantId");

-- AddForeignKey
ALTER TABLE "whatsapp_config_tenant" ADD CONSTRAINT "whatsapp_config_tenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
