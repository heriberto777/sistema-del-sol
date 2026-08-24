-- AlterEnum
-- Separado en su propia migración: Postgres no permite usar un valor de
-- enum recién agregado dentro de la MISMA transacción que lo agregó (la
-- migración siguiente inserta filas con 'PUNTOS_LEALTAD').
ALTER TYPE "TipoFormaPago" ADD VALUE 'PUNTOS_LEALTAD';
