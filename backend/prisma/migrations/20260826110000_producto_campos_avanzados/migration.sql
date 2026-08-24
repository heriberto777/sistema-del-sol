-- AlterTable
ALTER TABLE "productos" ADD COLUMN "precioVariable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "productos" ADD COLUMN "esIngrediente" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "productos" ADD COLUMN "permiteDevolucion" BOOLEAN NOT NULL DEFAULT true;
