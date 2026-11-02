-- Fase 3 (CxC/CxP como ledger real) — limpieza final. `Pago` queda
-- completamente reemplazado por `ReciboIngreso`/`AplicacionCobro` (ventas)
-- y `OrdenPago`/`AplicacionPago` (compras). Antes de aplicar esto en
-- cualquier ambiente con datos reales, correr una sola vez:
--   pnpm --filter ./backend pagos:backfill-historico
-- (reconstruye el historial de Pago como ReciboIngreso/OrdenPago para
-- auditoría — no toca CuentaPorCobrar/CuentaPorPagar.saldo, que los
-- backfills de Fase 1/2 ya dejaron correctos).
-- DropForeignKey
ALTER TABLE "pagos" DROP CONSTRAINT "pagos_facturaId_fkey";

-- DropForeignKey
ALTER TABLE "pagos" DROP CONSTRAINT "pagos_formaPagoId_fkey";

-- DropForeignKey
ALTER TABLE "pagos" DROP CONSTRAINT "pagos_ordenCompraId_fkey";

-- DropForeignKey
ALTER TABLE "pagos" DROP CONSTRAINT "pagos_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "pagos" DROP CONSTRAINT "pagos_userId_fkey";

-- AlterTable
ALTER TABLE "sesiones_cobro_factura" DROP COLUMN "pagoId";

-- DropTable
DROP TABLE "pagos";
