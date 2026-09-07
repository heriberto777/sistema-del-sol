-- AlterEnum: secuencial atómico para el generador interno de códigos de
-- barra (ver generador-codigo-barras.util.ts) — en su propia migración
-- por la misma regla de Postgres (ALTER TYPE ADD VALUE en su propia
-- transacción).
ALTER TYPE "TipoCorrelativo" ADD VALUE 'CODIGO_BARRAS';
