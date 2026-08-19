-- Fase 3c (incremento 3) de adopción de Cuadre: las líneas de venta/compra
-- graban la variante realmente vendida/comprada, no solo el producto —
-- necesario para que anular()/devolver() reintegren stock a la MISMA
-- variante. Backfill determinista: cada línea existente se asigna a la
-- variante más antigua (`createdAt` ASC) de su producto — en este momento
-- todo producto backfilleado en incrementos anteriores tiene como mucho
-- una variante real por historial de ventas (las regeneraciones de
-- variantes están bloqueadas si el producto ya tiene movimientos —
-- ver VariantesService.generarCombinaciones), así que es no ambiguo.

-- AlterTable: columnas nuevas, todavía nullable para poder migrar datos.
ALTER TABLE "linea_factura" ADD COLUMN "varianteId" TEXT;
ALTER TABLE "linea_cotizacion" ADD COLUMN "varianteId" TEXT;
ALTER TABLE "linea_remision" ADD COLUMN "varianteId" TEXT;
ALTER TABLE "linea_oc" ADD COLUMN "varianteId" TEXT;
ALTER TABLE "linea_recepcion" ADD COLUMN "varianteId" TEXT;
ALTER TABLE "linea_devolucion_compra" ADD COLUMN "varianteId" TEXT;
ALTER TABLE "lineas_venta_aparcada" ADD COLUMN "varianteId" TEXT;

-- Backfill: la variante más antigua del producto de cada línea.
UPDATE "linea_factura" lf
SET "varianteId" = vp.id
FROM (SELECT DISTINCT ON ("productoId") id, "productoId" FROM "variantes_producto" ORDER BY "productoId", "createdAt" ASC) vp
WHERE vp."productoId" = lf."productoId";

UPDATE "linea_cotizacion" lc
SET "varianteId" = vp.id
FROM (SELECT DISTINCT ON ("productoId") id, "productoId" FROM "variantes_producto" ORDER BY "productoId", "createdAt" ASC) vp
WHERE vp."productoId" = lc."productoId";

UPDATE "linea_remision" lr
SET "varianteId" = vp.id
FROM (SELECT DISTINCT ON ("productoId") id, "productoId" FROM "variantes_producto" ORDER BY "productoId", "createdAt" ASC) vp
WHERE vp."productoId" = lr."productoId";

UPDATE "linea_oc" lo
SET "varianteId" = vp.id
FROM (SELECT DISTINCT ON ("productoId") id, "productoId" FROM "variantes_producto" ORDER BY "productoId", "createdAt" ASC) vp
WHERE vp."productoId" = lo."productoId";

UPDATE "linea_recepcion" lrc
SET "varianteId" = vp.id
FROM (SELECT DISTINCT ON ("productoId") id, "productoId" FROM "variantes_producto" ORDER BY "productoId", "createdAt" ASC) vp
WHERE vp."productoId" = lrc."productoId";

UPDATE "linea_devolucion_compra" ldc
SET "varianteId" = vp.id
FROM (SELECT DISTINCT ON ("productoId") id, "productoId" FROM "variantes_producto" ORDER BY "productoId", "createdAt" ASC) vp
WHERE vp."productoId" = ldc."productoId";

UPDATE "lineas_venta_aparcada" lva
SET "varianteId" = vp.id
FROM (SELECT DISTINCT ON ("productoId") id, "productoId" FROM "variantes_producto" ORDER BY "productoId", "createdAt" ASC) vp
WHERE vp."productoId" = lva."productoId";

-- Endurecer NOT NULL + agregar las FK (Restrict: perder a qué variante
-- corresponde una línea ya emitida/recibida sería perder historial real).
ALTER TABLE "linea_factura" ALTER COLUMN "varianteId" SET NOT NULL;
ALTER TABLE "linea_factura" ADD CONSTRAINT "linea_factura_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "linea_cotizacion" ALTER COLUMN "varianteId" SET NOT NULL;
ALTER TABLE "linea_cotizacion" ADD CONSTRAINT "linea_cotizacion_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "linea_remision" ALTER COLUMN "varianteId" SET NOT NULL;
ALTER TABLE "linea_remision" ADD CONSTRAINT "linea_remision_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lineas_venta_aparcada" ALTER COLUMN "varianteId" SET NOT NULL;
ALTER TABLE "lineas_venta_aparcada" ADD CONSTRAINT "lineas_venta_aparcada_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "linea_oc" ALTER COLUMN "varianteId" SET NOT NULL;
ALTER TABLE "linea_oc" ADD CONSTRAINT "linea_oc_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "linea_recepcion" ALTER COLUMN "varianteId" SET NOT NULL;
ALTER TABLE "linea_recepcion" ADD CONSTRAINT "linea_recepcion_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "linea_devolucion_compra" ALTER COLUMN "varianteId" SET NOT NULL;
ALTER TABLE "linea_devolucion_compra" ADD CONSTRAINT "linea_devolucion_compra_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
