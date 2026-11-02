-- CreateEnum
CREATE TYPE "AplicaTerminoPago" AS ENUM ('CLIENTE', 'PROVEEDOR', 'AMBOS');

-- CreateEnum
CREATE TYPE "EstadoCxC" AS ENUM ('ABIERTA', 'PARCIAL', 'PAGADA', 'ANULADA');

-- CreateTable
CREATE TABLE "terminos_pago" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dias" INTEGER NOT NULL,
    "descuentoProntoPagoPct" DECIMAL(5,2),
    "diasProntoPago" INTEGER,
    "aplicaA" "AplicaTerminoPago" NOT NULL DEFAULT 'AMBOS',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terminos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_por_cobrar" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "terminoPagoId" TEXT,
    "concepto" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "tasaCambio" DECIMAL(14,6),
    "monto" DECIMAL(14,2) NOT NULL,
    "montoMoneda" DECIMAL(14,2),
    "saldo" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCxC" NOT NULL DEFAULT 'ABIERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_por_cobrar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terminos_pago_tenantId_nombre_key" ON "terminos_pago"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_por_cobrar_facturaId_key" ON "cuentas_por_cobrar"("facturaId");

-- CreateIndex
CREATE INDEX "cuentas_por_cobrar_tenantId_clienteId_idx" ON "cuentas_por_cobrar"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "cuentas_por_cobrar_tenantId_estado_idx" ON "cuentas_por_cobrar"("tenantId", "estado");

-- Backfill: una CuentaPorCobrar por cada Factura CREDITO EMITIDA existente
-- (CONTADO nunca genera una, igual criterio que FacturacionService.crear()
-- de acá en más), con saldo = total - pagos ya registrados contra ella
-- (Pago.facturaId) y estado derivado de pagada/saldo resultante.
INSERT INTO "cuentas_por_cobrar" (
  "id", "tenantId", "clienteId", "facturaId", "concepto", "moneda",
  "tasaCambio", "monto", "montoMoneda", "saldo", "fecha", "fechaVencimiento",
  "estado", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  f."tenantId",
  f."clienteId",
  f."id",
  'Factura ' || COALESCE(f."numero", f."ncf", f."id"),
  f."moneda",
  f."tasaCambio",
  f."total",
  f."totalMoneda",
  GREATEST(f."total" - COALESCE(p."totalPagado", 0), 0),
  f."fecha",
  f."fecha" + make_interval(days => f."plazoPagoDias"),
  CASE
    WHEN f."pagada" OR f."total" - COALESCE(p."totalPagado", 0) <= 0.005 THEN 'PAGADA'
    WHEN COALESCE(p."totalPagado", 0) > 0 THEN 'PARCIAL'
    ELSE 'ABIERTA'
  END::"EstadoCxC",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "facturas" f
LEFT JOIN (
  SELECT "facturaId", SUM("monto") AS "totalPagado"
  FROM "pagos"
  WHERE "facturaId" IS NOT NULL
  GROUP BY "facturaId"
) p ON p."facturaId" = f."id"
WHERE f."tipoFactura" = 'CREDITO' AND f."estado" = 'EMITIDA';

-- AddForeignKey
ALTER TABLE "terminos_pago" ADD CONSTRAINT "terminos_pago_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_cobrar" ADD CONSTRAINT "cuentas_por_cobrar_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_cobrar" ADD CONSTRAINT "cuentas_por_cobrar_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_cobrar" ADD CONSTRAINT "cuentas_por_cobrar_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_cobrar" ADD CONSTRAINT "cuentas_por_cobrar_terminoPagoId_fkey" FOREIGN KEY ("terminoPagoId") REFERENCES "terminos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
