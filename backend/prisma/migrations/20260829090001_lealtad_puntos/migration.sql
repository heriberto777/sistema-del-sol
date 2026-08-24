-- AlterTable
ALTER TABLE "formas_pago" ADD COLUMN "esPuntosLealtad" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "puntosLealtad" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "ModoAcumulacionLealtad" AS ENUM ('POR_MONTO', 'POR_UNIDAD');

-- CreateEnum
CREATE TYPE "CalculoLealtad" AS ENUM ('SUBTOTAL', 'TOTAL');

-- CreateEnum
CREATE TYPE "TipoMovimientoLealtad" AS ENUM ('ACUMULACION', 'CANJE', 'EXPIRACION', 'AJUSTE');

-- CreateTable
CREATE TABLE "configuraciones_lealtad" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "modoAcumulacion" "ModoAcumulacionLealtad" NOT NULL DEFAULT 'POR_MONTO',
    "montoPorPunto" DECIMAL(14,4),
    "calcularSobre" "CalculoLealtad" NOT NULL DEFAULT 'SUBTOTAL',
    "itemsConDescuentoGeneranPuntos" BOOLEAN NOT NULL DEFAULT true,
    "valorPunto" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "minimoParaCanjear" INTEGER NOT NULL DEFAULT 0,
    "diasExpiracion" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuraciones_lealtad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_lealtad" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" "TipoMovimientoLealtad" NOT NULL,
    "puntos" INTEGER NOT NULL,
    "puntosDisponibles" INTEGER NOT NULL DEFAULT 0,
    "facturaId" TEXT,
    "expiraEn" TIMESTAMP(3),
    "motivo" TEXT,
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_lealtad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuraciones_lealtad_tenantId_key" ON "configuraciones_lealtad"("tenantId");

-- CreateIndex
CREATE INDEX "movimientos_lealtad_tenantId_clienteId_idx" ON "movimientos_lealtad"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "movimientos_lealtad_tenantId_expiraEn_idx" ON "movimientos_lealtad"("tenantId", "expiraEn");

-- AddForeignKey
ALTER TABLE "configuraciones_lealtad" ADD CONSTRAINT "configuraciones_lealtad_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_lealtad" ADD CONSTRAINT "movimientos_lealtad_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_lealtad" ADD CONSTRAINT "movimientos_lealtad_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_lealtad" ADD CONSTRAINT "movimientos_lealtad_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: tenants ya provisionados no reciben FORMAS_PAGO_BASE de nuevo
-- (solo corre al crear un tenant) — se siembra "Puntos de Lealtad" a mano,
-- igual criterio que la migración histórica de formas_pago.
INSERT INTO "formas_pago" ("id", "tenantId", "nombre", "requiereReferencia", "esEfectivo", "esBono", "esPuntosLealtad", "tipo", "activa", "createdAt")
SELECT gen_random_uuid(), t."id", 'Puntos de Lealtad', false, false, false, true, 'PUNTOS_LEALTAD', true, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "formas_pago" fp WHERE fp."tenantId" = t."id" AND fp."nombre" = 'Puntos de Lealtad'
);
