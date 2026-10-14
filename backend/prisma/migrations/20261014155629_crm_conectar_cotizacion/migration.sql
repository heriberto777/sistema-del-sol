-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "motivoRechazo" TEXT;

-- AddForeignKey
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
