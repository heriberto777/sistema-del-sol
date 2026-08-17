-- DropForeignKey
ALTER TABLE "pagos_plataforma" DROP CONSTRAINT "pagos_plataforma_registradoPorId_fkey";

-- AlterTable
ALTER TABLE "pagos_plataforma" ALTER COLUMN "registradoPorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "pagos_plataforma" ADD CONSTRAINT "pagos_plataforma_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

