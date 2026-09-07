-- Plugin de Proyectos: flags de deduplicación de notificaciones (Event Bus)
ALTER TABLE "hitos_proyecto" ADD COLUMN "alertaVencimientoEnviada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "proyectos" ADD COLUMN "alertaPresupuestoEnviada" BOOLEAN NOT NULL DEFAULT false;
