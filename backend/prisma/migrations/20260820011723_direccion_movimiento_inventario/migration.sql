-- CreateEnum
CREATE TYPE "DireccionMovimiento" AS ENUM ('ENTRADA', 'SALIDA');

-- AlterTable: nullable primero para poder backfillear filas existentes
ALTER TABLE "movimiento_inventario" ADD COLUMN     "direccion" "DireccionMovimiento";

-- Backfill: ENTRADA/SALIDA mapean directo. AJUSTE/TRANSFERENCIA no tienen
-- signo reconstruible (ver ARCHITECTURE.md, Kardex) — se asume ENTRADA por
-- defecto, limitación conocida y documentada.
UPDATE "movimiento_inventario" SET "direccion" = 'SALIDA' WHERE "tipo" = 'SALIDA';
UPDATE "movimiento_inventario" SET "direccion" = 'ENTRADA' WHERE "direccion" IS NULL;

-- AlterTable: ahora sí NOT NULL
ALTER TABLE "movimiento_inventario" ALTER COLUMN "direccion" SET NOT NULL;
