-- AlterTable
ALTER TABLE "webhooks" ALTER COLUMN "secret" DROP NOT NULL;
ALTER TABLE "webhooks" ADD COLUMN     "secretCifrado" TEXT;
