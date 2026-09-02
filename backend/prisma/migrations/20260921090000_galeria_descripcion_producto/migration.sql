-- AlterTable
ALTER TABLE "productos" ADD COLUMN "descripcionTienda" TEXT;

-- CreateTable
CREATE TABLE "imagenes_producto" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "imagen" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imagenes_producto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "imagenes_producto" ADD CONSTRAINT "imagenes_producto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
