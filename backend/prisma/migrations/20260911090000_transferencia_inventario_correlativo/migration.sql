-- AlterEnum: ítem E-1 — Transferencias de inventario ganan su propio
-- documento con número (TransferenciaInventario), mismo criterio que
-- AjusteInventario. Separada de la migración que crea las tablas por la
-- misma regla de Postgres (ALTER TYPE ADD VALUE en su propia transacción).
ALTER TYPE "TipoCorrelativo" ADD VALUE 'TRANSFERENCIA';
