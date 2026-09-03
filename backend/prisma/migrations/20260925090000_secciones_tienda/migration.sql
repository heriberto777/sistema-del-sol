-- CreateEnum
CREATE TYPE "TipoSeccionTienda" AS ENUM ('PRODUCTOS', 'CATEGORIA', 'BANNER', 'MINIGRID');

-- CreateTable
CREATE TABLE "secciones_tienda" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoSeccionTienda" NOT NULL,
    "titulo" TEXT NOT NULL,
    "subtitulo" TEXT,
    "ctaTexto" TEXT,
    "imagen" TEXT,
    "color" TEXT,
    "categoriaId" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secciones_tienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secciones_tienda_productos" (
    "id" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "secciones_tienda_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secciones_tienda_categorias" (
    "id" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "secciones_tienda_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "secciones_tienda_productos_seccionId_productoId_key" ON "secciones_tienda_productos"("seccionId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "secciones_tienda_categorias_seccionId_categoriaId_key" ON "secciones_tienda_categorias"("seccionId", "categoriaId");

-- AddForeignKey
ALTER TABLE "secciones_tienda" ADD CONSTRAINT "secciones_tienda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secciones_tienda" ADD CONSTRAINT "secciones_tienda_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secciones_tienda_productos" ADD CONSTRAINT "secciones_tienda_productos_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "secciones_tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secciones_tienda_productos" ADD CONSTRAINT "secciones_tienda_productos_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secciones_tienda_categorias" ADD CONSTRAINT "secciones_tienda_categorias_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "secciones_tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secciones_tienda_categorias" ADD CONSTRAINT "secciones_tienda_categorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
