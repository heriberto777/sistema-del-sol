-- AlterEnum
ALTER TYPE "TipoUsoIa" ADD VALUE 'EXTRACCION_FACTURA';

-- AlterTable
ALTER TABLE "plataforma_configuracion" ADD COLUMN     "iaExtraccionFacturaLimiteMensual" INTEGER NOT NULL DEFAULT 10;
