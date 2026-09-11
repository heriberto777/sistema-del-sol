-- CreateEnum
CREATE TYPE "EstadoContratoPropiedad" AS ENUM ('ACTIVO', 'ANULADO');

-- CreateTable
CREATE TABLE "contratos_propiedad" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" "OperacionPropiedad" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agenteId" TEXT,
    "porcentajeComision" DECIMAL(5,2),
    "montoComision" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "comisionPagada" BOOLEAN NOT NULL DEFAULT false,
    "comisionPagadaEn" TIMESTAMP(3),
    "estado" "EstadoContratoPropiedad" NOT NULL DEFAULT 'ACTIVO',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_propiedad_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contratos_propiedad" ADD CONSTRAINT "contratos_propiedad_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_propiedad" ADD CONSTRAINT "contratos_propiedad_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_propiedad" ADD CONSTRAINT "contratos_propiedad_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_propiedad" ADD CONSTRAINT "contratos_propiedad_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
