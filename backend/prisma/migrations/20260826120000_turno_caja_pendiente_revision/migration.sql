-- AlterEnum
ALTER TYPE "EstadoTurnoCaja" ADD VALUE 'PENDIENTE_REVISION';

-- AlterTable
ALTER TABLE "turnos_caja" ADD COLUMN "revisadoEn" TIMESTAMP(3);
ALTER TABLE "turnos_caja" ADD COLUMN "revisadoPorId" TEXT;

ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
