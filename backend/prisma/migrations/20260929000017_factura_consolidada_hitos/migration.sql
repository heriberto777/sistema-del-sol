-- Una factura consolidada vincula varios hitos a la vez — el guard de "un
-- hito nunca se factura dos veces" queda 100% en ProyectosService, no en
-- esta columna (ver comentario en schema.prisma).
DROP INDEX "hitos_proyecto_facturaId_key";
