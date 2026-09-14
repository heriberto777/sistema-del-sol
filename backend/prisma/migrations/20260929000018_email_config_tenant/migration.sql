-- SMTP propio por tenant — cuando está habilitado, EmailChannel.enviar()
-- lo usa para todo el correo de ese tenant en vez del SMTP compartido de
-- PlataformaConfiguracion (ver comentario en schema.prisma).
CREATE TABLE "email_config_tenant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPasswordCifrado" TEXT,
    "smtpFrom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_config_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_config_tenant_tenantId_key" ON "email_config_tenant"("tenantId");

-- AddForeignKey
ALTER TABLE "email_config_tenant" ADD CONSTRAINT "email_config_tenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
