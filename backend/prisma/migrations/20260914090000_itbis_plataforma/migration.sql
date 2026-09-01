-- Ítem "ITBIS en la facturación SaaS" (facturación de plataforma a tenants)

-- AlterTable: % de ITBIS global de la plataforma (0 = sin ITBIS)
ALTER TABLE "plataforma_configuracion" ADD COLUMN     "porcentajeItbis" DECIMAL(5,2) NOT NULL DEFAULT 18;

-- AlterTable: ITBIS de cada FacturaPlataforma (forward-only, default 0)
ALTER TABLE "facturas_plataforma" ADD COLUMN     "itbis" DECIMAL(14,2) NOT NULL DEFAULT 0;
