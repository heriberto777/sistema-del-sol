-- CreateEnum
CREATE TYPE "ModalidadFacturacion" AS ENUM ('NCF', 'ECF');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNcf" ADD VALUE 'E31';
ALTER TYPE "TipoNcf" ADD VALUE 'E32';
ALTER TYPE "TipoNcf" ADD VALUE 'E34';
ALTER TYPE "TipoNcf" ADD VALUE 'E33';

-- AlterTable
ALTER TABLE "asientos_contables" ADD COLUMN     "anulado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "motivoNota" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "modalidadFacturacion" "ModalidadFacturacion" NOT NULL DEFAULT 'NCF';
