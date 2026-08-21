-- CreateEnum
CREATE TYPE "ColorCategoria" AS ENUM ('GRIS', 'ROJO', 'NARANJA', 'AMBAR', 'VERDE', 'TURQUESA', 'CIAN', 'AZUL', 'INDIGO', 'MORADO', 'ROSA', 'FUCSIA');

-- AlterTable
ALTER TABLE "categorias" ADD COLUMN "color" "ColorCategoria";
