-- CreateEnum
CREATE TYPE "TipoCodigoAutorizacion" AS ENUM ('ANULACION_FACTURA', 'DEVOLUCION_POS');

-- CreateTable
CREATE TABLE "codigos_autorizacion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoCodigoAutorizacion" NOT NULL,
    "referenciaId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "usadoEn" TIMESTAMP(3),
    "solicitadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_autorizacion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "codigos_autorizacion_tenantId_tipo_referenciaId_idx" ON "codigos_autorizacion"("tenantId", "tipo", "referenciaId");

ALTER TABLE "codigos_autorizacion" ADD CONSTRAINT "codigos_autorizacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "codigos_autorizacion" ADD CONSTRAINT "codigos_autorizacion_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
