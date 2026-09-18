-- CreateEnum
CREATE TYPE "PlantillaDocumento" AS ENUM ('CLASICO', 'ECF_OFICIAL', 'MINIMALISTA', 'COMPACTO', 'EDITORIAL');

-- AlterTable
ALTER TABLE "bodegas" ADD COLUMN     "plantillaDocumento" "PlantillaDocumento";
