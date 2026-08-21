-- Plan de integración de brechas Cuadre, ítem G-7: agrega los 2 tipos de
-- período de nómina que faltaban (ya teníamos QUINCENAL/MENSUAL).
ALTER TYPE "TipoPeriodoNomina" ADD VALUE 'SEMANAL';
ALTER TYPE "TipoPeriodoNomina" ADD VALUE 'BIMENSUAL';
