-- AlterEnum: número interno de Factura (distinto del NCF) — ver el
-- comentario en TipoCorrelativo del schema. Separado de la migración
-- que agrega la columna porque Postgres no permite usar un valor de
-- enum recién agregado en la misma transacción que lo crea (mismo
-- criterio ya aplicado en 20260829090000_lealtad_puntos_enum).
ALTER TYPE "TipoCorrelativo" ADD VALUE 'FACTURA';
