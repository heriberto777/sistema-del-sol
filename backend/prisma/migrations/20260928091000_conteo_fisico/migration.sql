-- Conteo Físico vs Teórico: documento propio (numeración K-1), distinto
-- de AjusteInventario. Al aplicar, genera y confirma un AjusteInventario
-- real (motivo CORRECCION_CONTEO) solo con las líneas que tuvieron
-- diferencia — este modelo nunca mueve stock por sí mismo.

-- CreateEnum
CREATE TYPE "AlcanceConteoFisico" AS ENUM ('TOTAL', 'SELECCION');

-- CreateEnum
CREATE TYPE "EstadoConteoFisico" AS ENUM ('ABIERTO', 'APLICADO', 'CANCELADO');

-- AlterEnum
ALTER TYPE "TipoCorrelativo" ADD VALUE 'CONTEO_FISICO';

-- CreateTable
CREATE TABLE "conteos_fisicos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "bodegaId" TEXT NOT NULL,
    "alcance" "AlcanceConteoFisico" NOT NULL,
    "estado" "EstadoConteoFisico" NOT NULL DEFAULT 'ABIERTO',
    "notas" TEXT,
    "userId" TEXT NOT NULL,
    "ajusteId" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaAplicado" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conteos_fisicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineas_conteo_fisico" (
    "id" TEXT NOT NULL,
    "conteoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "cantidadTeorica" DECIMAL(14,4) NOT NULL,
    "cantidadContada" DECIMAL(14,4),
    "contadoPorId" TEXT,
    "contadoEn" TIMESTAMP(3),

    CONSTRAINT "lineas_conteo_fisico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conteos_fisicos_ajusteId_key" ON "conteos_fisicos"("ajusteId");

-- CreateIndex
CREATE UNIQUE INDEX "conteos_fisicos_tenantId_numero_key" ON "conteos_fisicos"("tenantId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "lineas_conteo_fisico_conteoId_varianteId_key" ON "lineas_conteo_fisico"("conteoId", "varianteId");

-- AddForeignKey
ALTER TABLE "conteos_fisicos" ADD CONSTRAINT "conteos_fisicos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteos_fisicos" ADD CONSTRAINT "conteos_fisicos_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteos_fisicos" ADD CONSTRAINT "conteos_fisicos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteos_fisicos" ADD CONSTRAINT "conteos_fisicos_ajusteId_fkey" FOREIGN KEY ("ajusteId") REFERENCES "ajuste_inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_conteo_fisico" ADD CONSTRAINT "lineas_conteo_fisico_conteoId_fkey" FOREIGN KEY ("conteoId") REFERENCES "conteos_fisicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_conteo_fisico" ADD CONSTRAINT "lineas_conteo_fisico_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_conteo_fisico" ADD CONSTRAINT "lineas_conteo_fisico_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
