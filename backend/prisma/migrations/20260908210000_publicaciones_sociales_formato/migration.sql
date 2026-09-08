-- CreateEnum
CREATE TYPE "FormatoPublicacionSocial" AS ENUM ('CUADRADO', 'VERTICAL');

-- AlterTable
ALTER TABLE "publicaciones_sociales" ADD COLUMN     "formato" "FormatoPublicacionSocial" NOT NULL DEFAULT 'CUADRADO';
