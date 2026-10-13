-- DropForeignKey
ALTER TABLE "linea_cotizacion" DROP CONSTRAINT "linea_cotizacion_varianteId_fkey";

-- DropForeignKey
ALTER TABLE "linea_factura" DROP CONSTRAINT "linea_factura_productoId_fkey";

-- DropForeignKey
ALTER TABLE "linea_factura" DROP CONSTRAINT "linea_factura_varianteId_fkey";

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "metodo" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "mensaje" TEXT NOT NULL,
    "stack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "error_logs_tenantId_createdAt_idx" ON "error_logs"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_factura" ADD CONSTRAINT "linea_factura_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_factura" ADD CONSTRAINT "linea_factura_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_cotizacion" ADD CONSTRAINT "linea_cotizacion_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
