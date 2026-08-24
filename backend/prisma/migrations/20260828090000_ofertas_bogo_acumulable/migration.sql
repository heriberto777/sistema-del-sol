-- AlterEnum
ALTER TYPE "TipoDescuentoOferta" ADD VALUE 'BOGO';

-- AlterTable
ALTER TABLE "ofertas" ALTER COLUMN "valor" DROP NOT NULL;
ALTER TABLE "ofertas" ADD COLUMN "comprarCantidad" INTEGER;
ALTER TABLE "ofertas" ADD COLUMN "llevarCantidad" INTEGER;
ALTER TABLE "ofertas" ADD COLUMN "porcentajeDescuentoLlevar" DECIMAL(5,2);
ALTER TABLE "ofertas" ADD COLUMN "descuentoMaximoMonto" DECIMAL(14,2);
ALTER TABLE "ofertas" ADD COLUMN "acumulable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ofertas" ADD COLUMN "prioridad" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ofertas" ADD COLUMN "pagaComision" BOOLEAN NOT NULL DEFAULT true;
