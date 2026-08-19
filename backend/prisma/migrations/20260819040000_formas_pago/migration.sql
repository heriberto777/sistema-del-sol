-- FormaPago reemplaza al enum MetodoPago para Factura/Pago (queda vivo
-- solo para PagoPlataforma). Orden pensado para no perder datos: crear
-- tabla + sembrar catálogo por tenant, agregar columnas nuevas NULLABLE,
-- migrar los valores del enum viejo, y solo entonces borrar las columnas
-- viejas y endurecer las constraints.

-- CreateTable
CREATE TABLE "formas_pago" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "requiereReferencia" BOOLEAN NOT NULL DEFAULT false,
    "esEfectivo" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formas_pago_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "formas_pago_tenantId_nombre_key" ON "formas_pago"("tenantId", "nombre");

ALTER TABLE "formas_pago" ADD CONSTRAINT "formas_pago_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sembrar el catálogo de fábrica para cada tenant ya existente (mismos 6
-- valores que TenantsRepository.crearConProvisioning sembrará para los
-- nuevos, ver formas-pago-base.ts).
INSERT INTO "formas_pago" ("id", "tenantId", "nombre", "requiereReferencia", "esEfectivo", "activa")
SELECT gen_random_uuid(), t."id", v."nombre", v."requiereReferencia", v."esEfectivo", true
FROM "tenants" t
CROSS JOIN (VALUES
    ('Efectivo', false, true),
    ('Tarjeta', false, false),
    ('Transferencia', true, false),
    ('Crédito Cliente', false, false),
    ('Cheque', true, false),
    ('Nota de Crédito', false, false)
) AS v("nombre", "requiereReferencia", "esEfectivo");

-- AlterTable: columnas nuevas, todavía nullable para poder migrar datos.
ALTER TABLE "facturas" ADD COLUMN "formaPagoId" TEXT;
ALTER TABLE "facturas" ADD COLUMN "referenciaPago" TEXT;
ALTER TABLE "pagos" ADD COLUMN "formaPagoId" TEXT;
ALTER TABLE "pagos" ADD COLUMN "referencia" TEXT;

-- Migrar los valores existentes del enum viejo al FormaPago equivalente del mismo tenant.
UPDATE "facturas" f
SET "formaPagoId" = fp."id"
FROM "formas_pago" fp
WHERE fp."tenantId" = f."tenantId"
  AND fp."nombre" = (CASE f."metodoPago"
        WHEN 'EFECTIVO' THEN 'Efectivo'
        WHEN 'TARJETA' THEN 'Tarjeta'
        WHEN 'TRANSFERENCIA' THEN 'Transferencia'
      END)
  AND f."metodoPago" IS NOT NULL;

UPDATE "pagos" p
SET "formaPagoId" = fp."id"
FROM "formas_pago" fp
WHERE fp."tenantId" = p."tenantId"
  AND fp."nombre" = (CASE p."metodoPago"
        WHEN 'EFECTIVO' THEN 'Efectivo'
        WHEN 'TARJETA' THEN 'Tarjeta'
        WHEN 'TRANSFERENCIA' THEN 'Transferencia'
      END);

-- Ahora sí: borrar las columnas viejas y endurecer pagos.formaPagoId (Pago
-- siempre tiene una forma de pago, a diferencia de Factura que la deja
-- null salvo que venga de POS).
ALTER TABLE "facturas" DROP COLUMN "metodoPago";
ALTER TABLE "pagos" DROP COLUMN "metodoPago";
ALTER TABLE "pagos" ALTER COLUMN "formaPagoId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
