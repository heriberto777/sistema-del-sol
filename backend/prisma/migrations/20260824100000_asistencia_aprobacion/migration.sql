-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "registros_asistencia" ADD COLUMN "estado" "EstadoAsistencia" NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "registros_asistencia" ADD COLUMN "aprobadoPorId" TEXT;
ALTER TABLE "registros_asistencia" ADD COLUMN "fechaResolucion" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
