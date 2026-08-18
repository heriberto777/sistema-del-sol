-- CreateTable
CREATE TABLE "plataforma_configuracion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nombreNegocio" TEXT,
    "emailHabilitado" BOOLEAN,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPasswordCifrado" TEXT,
    "smtpFrom" TEXT,
    "twilioAccountSid" TEXT,
    "twilioAuthTokenCifrado" TEXT,
    "twilioWhatsappFrom" TEXT,
    "pasarelaActiva" TEXT,
    "stripeSecretKeyCifrado" TEXT,
    "stripeWebhookSecretCifrado" TEXT,
    "stripeCurrency" TEXT,
    "webhookUrl" TEXT,
    "webhookSecretCifrado" TEXT,
    "webhookActivo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "plataforma_configuracion_pkey" PRIMARY KEY ("id")
);

