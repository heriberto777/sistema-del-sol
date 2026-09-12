-- AlterTable
ALTER TABLE "plataforma_configuracion" ADD COLUMN     "duffelWebhookSecretCifrado" TEXT;

-- AlterTable
ALTER TABLE "travel_reservas" ADD COLUMN     "alertaProveedorDetalle" TEXT,
ADD COLUMN     "alertaProveedorEn" TIMESTAMP(3),
ADD COLUMN     "alertaProveedorTipo" TEXT;
