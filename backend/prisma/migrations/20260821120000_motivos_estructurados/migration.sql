-- Plan de integración de brechas Cuadre: E-2 (motivo estructurado de
-- ajuste de inventario) y F-5 (motivo estructurado de movimiento de caja).
-- Ambos nullable, coexisten con el texto libre existente (motivo/concepto)
-- sin reemplazarlo — sin backfill, ninguna fila existente lo necesita.

CREATE TYPE "MotivoAjusteInventario" AS ENUM ('MERMA', 'ROBO_PERDIDA', 'DANO', 'VENCIMIENTO', 'CORRECCION_CONTEO', 'OTRO');
ALTER TABLE "movimiento_inventario" ADD COLUMN "motivoAjuste" "MotivoAjusteInventario";

CREATE TYPE "MotivoMovimientoCaja" AS ENUM ('FONDO_CAMBIO', 'DEPOSITO', 'CORRECCION', 'OTRO');
ALTER TABLE "movimientos_caja" ADD COLUMN "motivoTipo" "MotivoMovimientoCaja";
