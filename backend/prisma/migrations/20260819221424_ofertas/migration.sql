-- CreateEnum
CREATE TYPE "TipoDescuentoOferta" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- CreateEnum
CREATE TYPE "AlcanceOferta" AS ENUM ('PRODUCTO', 'CATEGORIA', 'CARRITO');

-- CreateTable
CREATE TABLE "ofertas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoDescuento" "TipoDescuentoOferta" NOT NULL,
    "valor" DECIMAL(14,4) NOT NULL,
    "alcance" "AlcanceOferta" NOT NULL,
    "productoId" TEXT,
    "categoriaId" TEXT,
    "montoMinimoCarrito" DECIMAL(14,2),
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ofertas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
