-- CreateTable
CREATE TABLE "comentarios_tarea_proyecto" (
    "id" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_tarea_proyecto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "comentarios_tarea_proyecto" ADD CONSTRAINT "comentarios_tarea_proyecto_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas_proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_tarea_proyecto" ADD CONSTRAINT "comentarios_tarea_proyecto_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
