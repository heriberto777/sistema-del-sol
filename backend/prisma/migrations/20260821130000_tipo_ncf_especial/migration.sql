-- Plan de integración de brechas Cuadre, ítem B-1: equivalentes
-- electrónicos de B14 (Régimen Especial) y B15 (Gubernamental), que ahora
-- se pueden seleccionar de verdad al facturar (ver TIPO_NCF_ESPECIAL en
-- facturacion.service.ts) — antes solo existían como valores de enum
-- muertos, sin ningún flujo que los produjera.
ALTER TYPE "TipoNcf" ADD VALUE 'E44';
ALTER TYPE "TipoNcf" ADD VALUE 'E45';
