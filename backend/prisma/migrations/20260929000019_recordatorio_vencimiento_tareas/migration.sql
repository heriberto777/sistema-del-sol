-- Aviso único por email/WhatsApp el día que vence una tarea (Mis Tareas y
-- Proyectos) — mismo patrón booleano que HitoProyecto.alertaVencimientoEnviada.
ALTER TABLE "tareas_personales" ADD COLUMN "recordatorioEnviado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tareas_proyecto" ADD COLUMN "recordatorioEnviado" BOOLEAN NOT NULL DEFAULT false;
