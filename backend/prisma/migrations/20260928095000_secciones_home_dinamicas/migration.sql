-- AlterEnum
ALTER TYPE "TipoSeccionTienda" ADD VALUE 'HERO';
ALTER TYPE "TipoSeccionTienda" ADD VALUE 'DESTACADOS';
ALTER TYPE "TipoSeccionTienda" ADD VALUE 'OFERTAS';
ALTER TYPE "TipoSeccionTienda" ADD VALUE 'FRANJA_CONFIANZA';

-- AlterTable
ALTER TABLE "secciones_tienda" ADD COLUMN     "contenido" JSONB;
