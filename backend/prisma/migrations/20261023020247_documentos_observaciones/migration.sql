-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "observaciones" TEXT;

-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "observaciones" TEXT;

-- AlterTable
ALTER TABLE "personalizaciones_documento_tipo" ADD COLUMN     "observacionesVisibles" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "remisiones" ADD COLUMN     "observaciones" TEXT;
