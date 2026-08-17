-- AlterTable
ALTER TABLE "turnos_caja" ADD COLUMN     "cerradoPorId" TEXT,
ADD COLUMN     "justificacionDiferencia" TEXT;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_cerradoPorId_fkey" FOREIGN KEY ("cerradoPorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
