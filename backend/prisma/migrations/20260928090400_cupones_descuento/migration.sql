-- AlterTable
ALTER TABLE "suscripciones" ADD COLUMN     "primerPeriodoGratis" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "TipoCupon" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- CreateTable
CREATE TABLE "cupones_descuento" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoCupon" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "duracionCiclos" INTEGER,
    "fechaExpiracion" TIMESTAMP(3),
    "usosMaximos" INTEGER,
    "usosActuales" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cupones_descuento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suscripcion_cupones" (
    "id" TEXT NOT NULL,
    "suscripcionId" TEXT NOT NULL,
    "cuponId" TEXT NOT NULL,
    "ciclosRestantes" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaAplicado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripcion_cupones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cupones_descuento_codigo_key" ON "cupones_descuento"("codigo");

-- AddForeignKey
ALTER TABLE "suscripcion_cupones" ADD CONSTRAINT "suscripcion_cupones_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "suscripciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripcion_cupones" ADD CONSTRAINT "suscripcion_cupones_cuponId_fkey" FOREIGN KEY ("cuponId") REFERENCES "cupones_descuento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
