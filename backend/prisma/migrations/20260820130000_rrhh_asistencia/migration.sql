-- CreateTable
CREATE TABLE "registros_asistencia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaEntrada" TEXT,
    "horaSalida" TEXT,
    "tardanza" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "registros_asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registros_asistencia_tenantId_empleadoId_fecha_key" ON "registros_asistencia"("tenantId", "empleadoId", "fecha");

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

