-- CreateEnum
CREATE TYPE "PrioridadTareaPersonal" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "EstadoTareaPersonal" AS ENUM ('PENDIENTE', 'EN_CURSO', 'HECHA');

-- CreateTable
CREATE TABLE "tareas_personales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "prioridad" "PrioridadTareaPersonal" NOT NULL DEFAULT 'MEDIA',
    "estado" "EstadoTareaPersonal" NOT NULL DEFAULT 'PENDIENTE',
    "fecha" TIMESTAMP(3),
    "completadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tareas_personales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios_tarea_personal" (
    "id" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "imagenes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_tarea_personal_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tareas_personales" ADD CONSTRAINT "tareas_personales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_personales" ADD CONSTRAINT "tareas_personales_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_tarea_personal" ADD CONSTRAINT "comentarios_tarea_personal_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas_personales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_tarea_personal" ADD CONSTRAINT "comentarios_tarea_personal_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
