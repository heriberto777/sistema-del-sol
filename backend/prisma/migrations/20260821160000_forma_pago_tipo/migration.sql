-- CreateEnum
CREATE TYPE "TipoFormaPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'BONO_VOUCHER', 'NOTA_CREDITO', 'CHEQUE');

-- AlterTable
ALTER TABLE "formas_pago" ADD COLUMN "tipo" "TipoFormaPago";

-- Backfill best-effort solo para los nombres de fábrica sembrados por FORMAS_PAGO_BASE — una forma de pago con nombre personalizado se deja null (no hay forma confiable de inferir su tipo).
UPDATE "formas_pago" SET "tipo" = 'EFECTIVO' WHERE "nombre" = 'Efectivo';
UPDATE "formas_pago" SET "tipo" = 'TARJETA' WHERE "nombre" = 'Tarjeta';
UPDATE "formas_pago" SET "tipo" = 'TRANSFERENCIA' WHERE "nombre" = 'Transferencia';
UPDATE "formas_pago" SET "tipo" = 'CREDITO' WHERE "nombre" = 'Crédito Cliente';
UPDATE "formas_pago" SET "tipo" = 'CHEQUE' WHERE "nombre" = 'Cheque';
UPDATE "formas_pago" SET "tipo" = 'NOTA_CREDITO' WHERE "nombre" = 'Nota de Crédito';
UPDATE "formas_pago" SET "tipo" = 'BONO_VOUCHER' WHERE "nombre" = 'Bono';
