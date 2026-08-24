-- CreateTable
CREATE TABLE "plantillas_horario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "predeterminada" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantillas_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantilla_horario_dias" (
    "id" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "horaEntrada" TEXT NOT NULL,
    "horaSalida" TEXT NOT NULL,

    CONSTRAINT "plantilla_horario_dias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plantillas_horario_tenantId_codigo_key" ON "plantillas_horario"("tenantId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "plantilla_horario_dias_plantillaId_diaSemana_key" ON "plantilla_horario_dias"("plantillaId", "diaSemana");

-- AlterTable
ALTER TABLE "empleados" ADD COLUMN "plantillaHorarioId" TEXT;

-- AddForeignKey
ALTER TABLE "plantillas_horario" ADD CONSTRAINT "plantillas_horario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantilla_horario_dias" ADD CONSTRAINT "plantilla_horario_dias_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_horario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_plantillaHorarioId_fkey" FOREIGN KEY ("plantillaHorarioId") REFERENCES "plantillas_horario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
