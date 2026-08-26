-- AlterTable: línea manual/libre (ítem B-9, plan de integración Cuadre) —
-- productoId/varianteId nullable, exactamente uno de (productoId) o
-- (descripcionManual) presente por línea, invariante validada en
-- FacturacionService/CotizacionesService (no con un CHECK de Postgres).
ALTER TABLE "linea_factura" ALTER COLUMN "productoId" DROP NOT NULL;
ALTER TABLE "linea_factura" ALTER COLUMN "varianteId" DROP NOT NULL;
ALTER TABLE "linea_factura" ADD COLUMN "descripcionManual" TEXT;

ALTER TABLE "linea_cotizacion" ALTER COLUMN "productoId" DROP NOT NULL;
ALTER TABLE "linea_cotizacion" ALTER COLUMN "varianteId" DROP NOT NULL;
ALTER TABLE "linea_cotizacion" ADD COLUMN "descripcionManual" TEXT;
