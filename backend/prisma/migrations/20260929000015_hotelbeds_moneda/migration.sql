-- Hotelbeds cotiza siempre en EUR; estas dos columnas permiten configurar
-- una moneda de venta distinta con una tasa de cambio manual (ver
-- HotelbedsAdapter — conversión aplicada ahí, no en el resto de la app).
ALTER TABLE "plataforma_configuracion" ADD COLUMN "hotelbedsMoneda" TEXT;
ALTER TABLE "plataforma_configuracion" ADD COLUMN "hotelbedsTasaCambio" DECIMAL(12,6);
