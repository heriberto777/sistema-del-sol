-- CreateTable
CREATE TABLE "sesiones_trabajo_tarea" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),

    CONSTRAINT "sesiones_trabajo_tarea_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sesiones_trabajo_tarea" ADD CONSTRAINT "sesiones_trabajo_tarea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_trabajo_tarea" ADD CONSTRAINT "sesiones_trabajo_tarea_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas_proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_trabajo_tarea" ADD CONSTRAINT "sesiones_trabajo_tarea_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
