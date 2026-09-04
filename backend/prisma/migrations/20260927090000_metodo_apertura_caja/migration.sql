-- CreateEnum
CREATE TYPE "MetodoAperturaCaja" AS ENUM ('NINGUNO', 'AGENTE_LOCAL', 'WEB_SERIAL');

-- AlterTable
ALTER TABLE "bodegas" ADD COLUMN "metodoAperturaCaja" "MetodoAperturaCaja";
