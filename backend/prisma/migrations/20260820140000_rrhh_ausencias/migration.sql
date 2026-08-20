-- CreateEnum
CREATE TYPE "TipoAusencia" AS ENUM ('VACACIONES', 'ENFERMEDAD', 'PERMISO', 'INJUSTIFICADA', 'MATERNIDAD_PATERNIDAD', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoAusencia" AS ENUM ('SOLICITADA', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "ausencias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "tipo" "TipoAusencia" NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "conGoceDeSueldo" BOOLEAN NOT NULL,
    "motivo" TEXT,
    "estado" "EstadoAusencia" NOT NULL DEFAULT 'SOLICITADA',
    "solicitadoPorId" TEXT NOT NULL,
    "aprobadoPorId" TEXT,
    "fechaResolucion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ausencias_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

