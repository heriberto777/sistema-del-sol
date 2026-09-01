-- Ítem "e-CF real" (pieza 1) — datos del emisor self-service por tenant

ALTER TABLE "tenants" ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "email" TEXT;
