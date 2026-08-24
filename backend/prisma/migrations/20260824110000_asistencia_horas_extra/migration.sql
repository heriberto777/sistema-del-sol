-- AlterTable
ALTER TABLE "registros_asistencia" ADD COLUMN "salidaAnticipada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "registros_asistencia" ADD COLUMN "horasExtra" DECIMAL(5,2);
