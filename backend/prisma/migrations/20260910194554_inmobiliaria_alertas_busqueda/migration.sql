-- CreateTable
CREATE TABLE "alertas_busqueda_propiedad" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "operacion" "OperacionPropiedad",
    "tipo" "TipoPropiedad",
    "ubicacion" TEXT,
    "precioMax" DECIMAL(14,2),
    "habitacionesMin" INTEGER,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "ultimaNotificacionEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_busqueda_propiedad_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "alertas_busqueda_propiedad" ADD CONSTRAINT "alertas_busqueda_propiedad_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
