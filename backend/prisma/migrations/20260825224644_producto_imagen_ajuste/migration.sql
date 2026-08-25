-- CreateEnum
CREATE TYPE "AjusteImagenProducto" AS ENUM ('COVER', 'CONTAIN', 'FILL', 'NONE', 'SCALE_DOWN');

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "imagenAjuste" "AjusteImagenProducto" NOT NULL DEFAULT 'COVER';
