-- AlterTable
ALTER TABLE "linea_factura" ADD COLUMN     "centroCostoId" TEXT;

-- AlterTable
ALTER TABLE "linea_oc" ADD COLUMN     "centroCostoId" TEXT;

-- AlterTable
ALTER TABLE "linea_recepcion" ADD COLUMN     "centroCostoId" TEXT;

-- AlterTable
ALTER TABLE "lineas_asiento" ADD COLUMN     "centroCostoId" TEXT;

-- AlterTable
ALTER TABLE "lineas_factura_proveedor" ADD COLUMN     "centroCostoId" TEXT;

-- AlterTable
ALTER TABLE "lineas_gasto_menor" ADD COLUMN     "centroCostoId" TEXT;

-- CreateTable
CREATE TABLE "centros_costo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "centros_costo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "centros_costo_tenantId_nombre_key" ON "centros_costo"("tenantId", "nombre");

-- AddForeignKey
ALTER TABLE "linea_factura" ADD CONSTRAINT "linea_factura_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_gasto_menor" ADD CONSTRAINT "lineas_gasto_menor_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_asiento" ADD CONSTRAINT "lineas_asiento_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_oc" ADD CONSTRAINT "linea_oc_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_recepcion" ADD CONSTRAINT "linea_recepcion_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_factura_proveedor" ADD CONSTRAINT "lineas_factura_proveedor_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

