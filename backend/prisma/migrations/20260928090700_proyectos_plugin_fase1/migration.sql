-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('PLANIFICADO', 'EN_CURSO', 'PAUSADO', 'TERMINADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ModoFacturacionProyecto" AS ENUM ('PRECIO_FIJO', 'POR_HORAS');

-- CreateEnum
CREATE TYPE "EstadoHitoProyecto" AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'FACTURADO');

-- CreateEnum
CREATE TYPE "EstadoTareaProyecto" AS ENUM ('PENDIENTE', 'EN_CURSO', 'EN_REVISION', 'TERMINADA');

-- CreateEnum
CREATE TYPE "PrioridadTareaProyecto" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- AlterTable
ALTER TABLE "gastos_menores" ADD COLUMN     "proyectoId" TEXT;

-- CreateTable
CREATE TABLE "proyectos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "clienteId" TEXT NOT NULL,
    "responsableId" TEXT,
    "presupuesto" DECIMAL(14,2),
    "modoFacturacion" "ModoFacturacionProyecto" NOT NULL DEFAULT 'PRECIO_FIJO',
    "tarifaHoraFacturable" DECIMAL(14,2),
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'PLANIFICADO',
    "fechaInicio" TIMESTAMP(3),
    "fechaFinEstimada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hitos_proyecto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaObjetivo" TIMESTAMP(3),
    "montoFijo" DECIMAL(14,2),
    "estado" "EstadoHitoProyecto" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hitos_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas_proyecto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "hitoId" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoTareaProyecto" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "PrioridadTareaProyecto" NOT NULL DEFAULT 'MEDIA',
    "fechaVencimiento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tareas_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarea_proyecto_responsables" (
    "id" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,

    CONSTRAINT "tarea_proyecto_responsables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_hora_proyecto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horas" DECIMAL(5,2) NOT NULL,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_hora_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tarea_proyecto_responsables_tareaId_empleadoId_key" ON "tarea_proyecto_responsables"("tareaId", "empleadoId");

-- AddForeignKey
ALTER TABLE "gastos_menores" ADD CONSTRAINT "gastos_menores_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hitos_proyecto" ADD CONSTRAINT "hitos_proyecto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hitos_proyecto" ADD CONSTRAINT "hitos_proyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_proyecto" ADD CONSTRAINT "tareas_proyecto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_proyecto" ADD CONSTRAINT "tareas_proyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_proyecto" ADD CONSTRAINT "tareas_proyecto_hitoId_fkey" FOREIGN KEY ("hitoId") REFERENCES "hitos_proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_proyecto_responsables" ADD CONSTRAINT "tarea_proyecto_responsables_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas_proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_proyecto_responsables" ADD CONSTRAINT "tarea_proyecto_responsables_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_hora_proyecto" ADD CONSTRAINT "registros_hora_proyecto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_hora_proyecto" ADD CONSTRAINT "registros_hora_proyecto_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas_proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_hora_proyecto" ADD CONSTRAINT "registros_hora_proyecto_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
