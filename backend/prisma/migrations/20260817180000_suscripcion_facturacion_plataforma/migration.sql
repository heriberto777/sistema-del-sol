-- CreateEnum
CREATE TYPE "EstadoSuscripcion" AS ENUM ('ACTIVA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoFacturaPlataforma" AS ENUM ('PENDIENTE', 'PAGADA', 'VENCIDA', 'ANULADA');

-- CreateTable
CREATE TABLE "suscripciones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "estado" "EstadoSuscripcion" NOT NULL DEFAULT 'ACTIVA',
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaProximoCorte" TIMESTAMP(3) NOT NULL,
    "feeMoraPct" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas_plataforma" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "suscripcionId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "montoMora" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "estado" "EstadoFacturaPlataforma" NOT NULL DEFAULT 'PENDIENTE',
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_plataforma" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "referencia" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registradoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_tenantId_key" ON "suscripciones"("tenantId");

-- CreateIndex
CREATE INDEX "pagos_plataforma_facturaId_idx" ON "pagos_plataforma"("facturaId");

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_plataforma" ADD CONSTRAINT "facturas_plataforma_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_plataforma" ADD CONSTRAINT "facturas_plataforma_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "suscripciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_plataforma" ADD CONSTRAINT "pagos_plataforma_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas_plataforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_plataforma" ADD CONSTRAINT "pagos_plataforma_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "platform_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

