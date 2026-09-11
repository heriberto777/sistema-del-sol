-- CreateEnum
CREATE TYPE "TipoPropiedad" AS ENUM ('APARTAMENTO', 'CASA', 'VILLA', 'PENTHOUSE', 'CONDOMINIO', 'SOLAR', 'LOCAL_COMERCIAL', 'OFICINA', 'NAVE_INDUSTRIAL', 'EDIFICIO', 'FINCA');

-- CreateEnum
CREATE TYPE "OperacionPropiedad" AS ENUM ('VENTA', 'ALQUILER');

-- CreateEnum
CREATE TYPE "EstadoPropiedad" AS ENUM ('ACTIVA', 'PAUSADA', 'RESERVADA', 'VENDIDA', 'ALQUILADA');

-- CreateTable
CREATE TABLE "propiedades" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoPropiedad" NOT NULL,
    "operacion" "OperacionPropiedad" NOT NULL,
    "estado" "EstadoPropiedad" NOT NULL DEFAULT 'ACTIVA',
    "precio" DECIMAL(14,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "ubicacion" TEXT NOT NULL,
    "habitaciones" INTEGER,
    "banos" DECIMAL(4,1),
    "parqueos" INTEGER,
    "metrosConstruccion" DECIMAL(10,2),
    "metrosTerreno" DECIMAL(10,2),
    "descripcion" TEXT,
    "amenidades" TEXT[],
    "agenteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propiedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imagenes_propiedad" (
    "id" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "imagen" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imagenes_propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "propiedades_tenantId_codigo_key" ON "propiedades"("tenantId", "codigo");

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagenes_propiedad" ADD CONSTRAINT "imagenes_propiedad_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
