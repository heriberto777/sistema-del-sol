-- Plugin "Tienda Online" (Fase 11) — opt-in manual de "producto destacado" en el storefront público.
ALTER TABLE "productos" ADD COLUMN "destacado" BOOLEAN NOT NULL DEFAULT false;
