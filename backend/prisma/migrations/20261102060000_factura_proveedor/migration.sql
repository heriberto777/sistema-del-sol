-- CreateEnum
CREATE TYPE "TipoFacturaProveedor" AS ENUM ('FACTURA', 'NOTA_CREDITO');

-- CreateEnum
CREATE TYPE "EstadoFacturaProveedor" AS ENUM ('EMITIDA', 'ANULADA');

-- AlterEnum
ALTER TYPE "OrigenAsiento" ADD VALUE 'FACTURA_PROVEEDOR';

-- AlterTable
ALTER TABLE "cuentas_por_pagar" ADD COLUMN     "facturaProveedorId" TEXT,
ALTER COLUMN "ordenCompraId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "facturas_proveedor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "tipo" "TipoFacturaProveedor" NOT NULL DEFAULT 'FACTURA',
    "facturaOrigenId" TEXT,
    "ncfProveedor" TEXT NOT NULL,
    "tipoNcfProveedor" "TipoNcf" NOT NULL,
    "concepto" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "itbis" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "terminoPagoId" TEXT,
    "estado" "EstadoFacturaProveedor" NOT NULL DEFAULT 'EMITIDA',
    "pagada" BOOLEAN NOT NULL DEFAULT false,
    "fechaPago" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturas_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineas_factura_proveedor" (
    "id" TEXT NOT NULL,
    "facturaProveedorId" TEXT NOT NULL,
    "cuentaContableId" TEXT NOT NULL,
    "concepto" TEXT,
    "valor" DECIMAL(14,2) NOT NULL,
    "porcentajeItbis" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "montoItbis" DECIMAL(14,2) NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "montoTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "lineas_factura_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facturas_proveedor_tenantId_estado_idx" ON "facturas_proveedor"("tenantId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_proveedor_tenantId_proveedorId_ncfProveedor_key" ON "facturas_proveedor"("tenantId", "proveedorId", "ncfProveedor");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_por_pagar_facturaProveedorId_key" ON "cuentas_por_pagar"("facturaProveedorId");

-- AddForeignKey
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_facturaProveedorId_fkey" FOREIGN KEY ("facturaProveedorId") REFERENCES "facturas_proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_proveedor" ADD CONSTRAINT "facturas_proveedor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_proveedor" ADD CONSTRAINT "facturas_proveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_proveedor" ADD CONSTRAINT "facturas_proveedor_facturaOrigenId_fkey" FOREIGN KEY ("facturaOrigenId") REFERENCES "facturas_proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_proveedor" ADD CONSTRAINT "facturas_proveedor_terminoPagoId_fkey" FOREIGN KEY ("terminoPagoId") REFERENCES "terminos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_proveedor" ADD CONSTRAINT "facturas_proveedor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_factura_proveedor" ADD CONSTRAINT "lineas_factura_proveedor_facturaProveedorId_fkey" FOREIGN KEY ("facturaProveedorId") REFERENCES "facturas_proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_factura_proveedor" ADD CONSTRAINT "lineas_factura_proveedor_cuentaContableId_fkey" FOREIGN KEY ("cuentaContableId") REFERENCES "cuentas_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint (agregado a mano, Prisma no lo expresa desde el schema —
-- ver el comentario de CuentaPorPagar en schema.prisma): una CuentaPorPagar
-- nace de una OrdenCompra (ordenCompraId) o de una FacturaProveedor
-- (facturaProveedorId), nunca de ambas ni de ninguna.
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_origen_unico_check" CHECK (
    ("ordenCompraId" IS NOT NULL AND "facturaProveedorId" IS NULL)
    OR ("ordenCompraId" IS NULL AND "facturaProveedorId" IS NOT NULL)
);

