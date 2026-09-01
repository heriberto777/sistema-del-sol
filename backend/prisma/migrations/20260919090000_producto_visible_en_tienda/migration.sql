-- Plugin "Tienda Online" (e-commerce v1) — opt-out de visibilidad en el storefront público.
ALTER TABLE "productos" ADD COLUMN "visibleEnTienda" BOOLEAN NOT NULL DEFAULT true;
