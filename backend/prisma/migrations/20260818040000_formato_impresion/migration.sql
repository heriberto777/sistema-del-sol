-- CreateEnum
CREATE TYPE "FormatoImpresion" AS ENUM ('CARTA', 'A4', 'TERMICA_80MM', 'TERMICA_58MM');

-- AlterTable
ALTER TABLE "bodegas" ADD COLUMN     "formatoImpresion" "FormatoImpresion";
