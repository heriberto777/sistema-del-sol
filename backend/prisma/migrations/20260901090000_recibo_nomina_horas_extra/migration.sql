-- AlterTable
ALTER TABLE "recibos_nomina" ADD COLUMN     "montoHorasExtra" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- RenameForeignKey
ALTER TABLE "turnos_caja" RENAME CONSTRAINT "turno_caja_cajaId_fkey" TO "turnos_caja_cajaId_fkey";
