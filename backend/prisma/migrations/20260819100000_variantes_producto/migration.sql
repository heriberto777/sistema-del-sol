-- Fase 3c (incremento 1) de adopción de Cuadre: Stock/Precio pasan a
-- colgar de VarianteProducto en vez de Producto directamente.
-- MovimientoInventario conserva su "productoId" (denormalizado, de solo
-- lectura, para no romper reportes existentes) y gana "varianteId" como
-- FK real. Orden pensado para no perder datos: crear variantes_producto,
-- sembrar una variante "por defecto" por cada Producto existente,
-- agregar columnas varianteId NULLABLE, migrar los datos usando el
-- productoId todavía presente, y solo entonces borrar columnas viejas y
-- endurecer constraints.

-- CreateTable
CREATE TABLE "variantes_producto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "sku" TEXT,
    "codigoBarras" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variantes_producto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "variantes_producto_tenantId_codigoBarras_key" ON "variantes_producto"("tenantId", "codigoBarras");

ALTER TABLE "variantes_producto" ADD CONSTRAINT "variantes_producto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "variantes_producto" ADD CONSTRAINT "variantes_producto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sembrar la variante "por defecto" de cada producto existente — sin
-- valores de atributo, exactamente una por producto en este momento.
INSERT INTO "variantes_producto" ("id", "tenantId", "productoId", "activa")
SELECT gen_random_uuid(), p."tenantId", p."id", true
FROM "productos" p;

-- CreateTable (atributos/valores — vacías, sin datos que migrar)
CREATE TABLE "atributos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atributos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "atributos_tenantId_nombre_key" ON "atributos"("tenantId", "nombre");
ALTER TABLE "atributos" ADD CONSTRAINT "atributos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "valores_atributo" (
    "id" TEXT NOT NULL,
    "atributoId" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "valores_atributo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "valores_atributo_atributoId_valor_key" ON "valores_atributo"("atributoId", "valor");
ALTER TABLE "valores_atributo" ADD CONSTRAINT "valores_atributo_atributoId_fkey" FOREIGN KEY ("atributoId") REFERENCES "atributos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "valores_atributo_variante" (
    "varianteId" TEXT NOT NULL,
    "valorAtributoId" TEXT NOT NULL,

    CONSTRAINT "valores_atributo_variante_pkey" PRIMARY KEY ("varianteId","valorAtributoId")
);
ALTER TABLE "valores_atributo_variante" ADD CONSTRAINT "valores_atributo_variante_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "valores_atributo_variante" ADD CONSTRAINT "valores_atributo_variante_valorAtributoId_fkey" FOREIGN KEY ("valorAtributoId") REFERENCES "valores_atributo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: columnas nuevas, todavía nullable para poder migrar datos.
ALTER TABLE "precios" ADD COLUMN "varianteId" TEXT;
ALTER TABLE "stock" ADD COLUMN "varianteId" TEXT;
ALTER TABLE "movimiento_inventario" ADD COLUMN "varianteId" TEXT;

-- Migrar cada fila al id de la variante "por defecto" de su producto
-- (todavía usando la columna productoId original, antes de borrarla).
UPDATE "precios" pr
SET "varianteId" = vp."id"
FROM "variantes_producto" vp
WHERE vp."productoId" = pr."productoId";

UPDATE "stock" s
SET "varianteId" = vp."id"
FROM "variantes_producto" vp
WHERE vp."productoId" = s."productoId";

UPDATE "movimiento_inventario" mi
SET "varianteId" = vp."id"
FROM "variantes_producto" vp
WHERE vp."productoId" = mi."productoId";

-- Ahora sí: borrar columnas/constraints viejas de precios y stock
-- (movimiento_inventario CONSERVA productoId a propósito, ver arriba).
ALTER TABLE "precios" DROP CONSTRAINT "precios_productoId_fkey";
DROP INDEX "precios_productoId_listaPrecio_vigenteDesde_idx";
ALTER TABLE "precios" DROP COLUMN "productoId";
ALTER TABLE "precios" ALTER COLUMN "varianteId" SET NOT NULL;
CREATE INDEX "precios_varianteId_listaPrecio_vigenteDesde_idx" ON "precios"("varianteId", "listaPrecio", "vigenteDesde");
ALTER TABLE "precios" ADD CONSTRAINT "precios_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock" DROP CONSTRAINT "stock_productoId_fkey";
DROP INDEX "stock_productoId_bodegaId_key";
ALTER TABLE "stock" DROP COLUMN "productoId";
ALTER TABLE "stock" ALTER COLUMN "varianteId" SET NOT NULL;
CREATE UNIQUE INDEX "stock_varianteId_bodegaId_key" ON "stock"("varianteId", "bodegaId");
ALTER TABLE "stock" ADD CONSTRAINT "stock_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "movimiento_inventario" ALTER COLUMN "varianteId" SET NOT NULL;
CREATE INDEX "movimiento_inventario_varianteId_idx" ON "movimiento_inventario"("varianteId");
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
