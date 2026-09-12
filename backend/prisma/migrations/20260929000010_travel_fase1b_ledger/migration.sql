-- CreateEnum
CREATE TYPE "TipoMovimientoLedgerTravel" AS ENUM ('DEBITO', 'CREDITO');

-- AlterTable
ALTER TABLE "travel_reservas" ADD COLUMN     "localizadorAerolinea" TEXT,
ADD COLUMN     "proveedor" TEXT,
ADD COLUMN     "proveedorCancelacionId" TEXT,
ADD COLUMN     "proveedorOfertaId" TEXT,
ADD COLUMN     "proveedorOrdenId" TEXT;

-- CreateTable
CREATE TABLE "travel_ledger_movimientos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservaId" TEXT,
    "tipo" "TipoMovimientoLedgerTravel" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "moneda" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travel_ledger_movimientos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "travel_ledger_movimientos" ADD CONSTRAINT "travel_ledger_movimientos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_ledger_movimientos" ADD CONSTRAINT "travel_ledger_movimientos_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "travel_reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
