-- CreateEnum
CREATE TYPE "TipoTravelReserva" AS ENUM ('VUELO', 'HOTEL');

-- CreateEnum
CREATE TYPE "EstadoTravelReserva" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'FACTURADA', 'CANCELADA');

-- AlterEnum
ALTER TYPE "TipoCorrelativo" ADD VALUE 'TRAVEL_RESERVA';

-- CreateTable
CREATE TABLE "travel_reservas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigoInterno" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" "TipoTravelReserva" NOT NULL,
    "estado" "EstadoTravelReserva" NOT NULL DEFAULT 'PENDIENTE',
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "montoCosto" DECIMAL(12,2) NOT NULL,
    "montoVenta" DECIMAL(12,2) NOT NULL,
    "notas" TEXT,
    "facturaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_reserva_pasajeros" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3),
    "tipoDocumento" TEXT,
    "numeroDocumento" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travel_reserva_pasajeros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "travel_reservas_facturaId_key" ON "travel_reservas"("facturaId");

-- CreateIndex
CREATE UNIQUE INDEX "travel_reservas_tenantId_codigoInterno_key" ON "travel_reservas"("tenantId", "codigoInterno");

-- AddForeignKey
ALTER TABLE "travel_reservas" ADD CONSTRAINT "travel_reservas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_reservas" ADD CONSTRAINT "travel_reservas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_reservas" ADD CONSTRAINT "travel_reservas_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_reserva_pasajeros" ADD CONSTRAINT "travel_reserva_pasajeros_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "travel_reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
