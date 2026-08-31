-- AlterEnum: ítem E-1 — Ajustes de inventario ganan su propio documento
-- con número (AjusteInventario). Separada de la migración que crea las
-- tablas porque Postgres no permite usar un valor de enum recién
-- agregado en la misma transacción que lo crea (mismo criterio ya
-- aplicado en 20260829090000_lealtad_puntos_enum / 20260909090000_tipo_correlativo_factura).
ALTER TYPE "TipoCorrelativo" ADD VALUE 'AJUSTE';
