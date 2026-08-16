-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('INDEFINIDO', 'DETERMINADO');

-- CreateEnum
CREATE TYPE "TipoPeriodoNomina" AS ENUM ('QUINCENAL', 'MENSUAL');

-- CreateEnum
CREATE TYPE "EstadoPeriodoNomina" AS ENUM ('BORRADOR', 'PROCESADO', 'PAGADO');

-- AlterEnum
ALTER TYPE "OrigenAsiento" ADD VALUE 'NOMINA';

-- CreateTable
CREATE TABLE "empleados" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "departamento" TEXT,
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "fechaSalida" TIMESTAMP(3),
    "salarioBrutoMensual" DECIMAL(14,2) NOT NULL,
    "tipoContrato" "TipoContrato" NOT NULL DEFAULT 'INDEFINIDO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos_nomina" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoPeriodoNomina" NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "estado" "EstadoPeriodoNomina" NOT NULL DEFAULT 'BORRADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_nomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recibos_nomina" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "salarioBruto" DECIMAL(14,2) NOT NULL,
    "sfsEmpleado" DECIMAL(14,2) NOT NULL,
    "afpEmpleado" DECIMAL(14,2) NOT NULL,
    "isr" DECIMAL(14,2) NOT NULL,
    "otrasDeducciones" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salarioNeto" DECIMAL(14,2) NOT NULL,
    "sfsEmpleador" DECIMAL(14,2) NOT NULL,
    "afpEmpleador" DECIMAL(14,2) NOT NULL,
    "infotep" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recibos_nomina_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empleados_tenantId_cedula_key" ON "empleados"("tenantId", "cedula");

-- CreateIndex
CREATE UNIQUE INDEX "recibos_nomina_periodoId_empleadoId_key" ON "recibos_nomina"("periodoId", "empleadoId");

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_nomina" ADD CONSTRAINT "periodos_nomina_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos_nomina" ADD CONSTRAINT "recibos_nomina_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos_nomina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos_nomina" ADD CONSTRAINT "recibos_nomina_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
