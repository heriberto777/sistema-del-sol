-- Reemplaza el booleano único `notificacionesHabilitadas` (apagaba Email y
-- WhatsApp juntos) por dos columnas independientes, una por canal.
-- Migración escrita a mano (no por `prisma migrate dev`) para preservar el
-- valor existente de cada cliente en ambos canales nuevos antes de borrar
-- la columna vieja — un `migrate dev` automático la habría dropeado sin
-- copiar el dato.

ALTER TABLE "clientes" ADD COLUMN "notificacionesEmailHabilitadas" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "clientes" ADD COLUMN "notificacionesWhatsappHabilitadas" BOOLEAN NOT NULL DEFAULT true;

UPDATE "clientes"
SET "notificacionesEmailHabilitadas" = "notificacionesHabilitadas",
    "notificacionesWhatsappHabilitadas" = "notificacionesHabilitadas";

ALTER TABLE "clientes" DROP COLUMN "notificacionesHabilitadas";
