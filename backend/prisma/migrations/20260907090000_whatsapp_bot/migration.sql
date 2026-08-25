-- AlterTable
ALTER TABLE "whatsapp_config_tenant" ADD COLUMN     "iaPromptNegocio" TEXT,
ADD COLUMN     "limiteRespuestasDiarias" INTEGER NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "whatsapp_mensajes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "requiereAtencionHumana" BOOLEAN NOT NULL DEFAULT false,
    "atendido" BOOLEAN NOT NULL DEFAULT false,
    "diaRD" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_config_tenant_twilioWhatsappFrom_key" ON "whatsapp_config_tenant"("twilioWhatsappFrom");

-- CreateIndex
CREATE INDEX "whatsapp_mensajes_tenantId_telefono_createdAt_idx" ON "whatsapp_mensajes"("tenantId", "telefono", "createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_mensajes_tenantId_diaRD_idx" ON "whatsapp_mensajes"("tenantId", "diaRD");

-- CreateIndex
CREATE INDEX "whatsapp_mensajes_tenantId_requiereAtencionHumana_atendido_idx" ON "whatsapp_mensajes"("tenantId", "requiereAtencionHumana", "atendido");

-- AddForeignKey
ALTER TABLE "whatsapp_mensajes" ADD CONSTRAINT "whatsapp_mensajes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
