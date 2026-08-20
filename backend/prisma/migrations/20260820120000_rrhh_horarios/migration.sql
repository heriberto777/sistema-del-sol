-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- AlterTable
ALTER TABLE "empleados" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "horarios_empleado" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "horaEntrada" TEXT NOT NULL,
    "horaSalida" TEXT NOT NULL,

    CONSTRAINT "horarios_empleado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "horarios_empleado_tenantId_empleadoId_diaSemana_key" ON "horarios_empleado"("tenantId", "empleadoId", "diaSemana");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_userId_key" ON "empleados"("userId");

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_empleado" ADD CONSTRAINT "horarios_empleado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_empleado" ADD CONSTRAINT "horarios_empleado_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

