-- CreateEnum
CREATE TYPE "CanalNotificacionVencimiento" AS ENUM ('EMAIL', 'WEBHOOK');

-- AlterTable
ALTER TABLE "plataforma_configuracion" ADD COLUMN     "diasParaAutoSuspender" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "reglas_notificacion_vencimiento" (
    "id" TEXT NOT NULL,
    "offsetDias" INTEGER NOT NULL,
    "canal" "CanalNotificacionVencimiento" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reglas_notificacion_vencimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones_vencimiento_enviadas" (
    "id" TEXT NOT NULL,
    "facturaPlataformaId" TEXT NOT NULL,
    "reglaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_vencimiento_enviadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notificaciones_vencimiento_enviadas_facturaPlataformaId_reg_key" ON "notificaciones_vencimiento_enviadas"("facturaPlataformaId", "reglaId");

-- AddForeignKey
ALTER TABLE "notificaciones_vencimiento_enviadas" ADD CONSTRAINT "notificaciones_vencimiento_enviadas_facturaPlataformaId_fkey" FOREIGN KEY ("facturaPlataformaId") REFERENCES "facturas_plataforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones_vencimiento_enviadas" ADD CONSTRAINT "notificaciones_vencimiento_enviadas_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "reglas_notificacion_vencimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
