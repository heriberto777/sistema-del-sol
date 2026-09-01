-- Ítem "Facturación con NCF real" (Administración de Tenants, última pieza)

-- AlterTable: datos de la empresa emisora + modalidad de facturación de la propia plataforma
ALTER TABLE "plataforma_configuracion" ADD COLUMN     "rnc" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "modalidadFacturacion" "ModalidadFacturacion" NOT NULL DEFAULT 'NCF';

-- AlterTable: NCF asignado a cada FacturaPlataforma (nullable, forward-only)
ALTER TABLE "facturas_plataforma" ADD COLUMN     "ncf" TEXT,
ADD COLUMN     "tipoNcf" "TipoNcf";

-- CreateTable
CREATE TABLE "ncf_plataforma" (
    "id" TEXT NOT NULL,
    "tipoNcf" "TipoNcf" NOT NULL,
    "secuenciaActual" INTEGER NOT NULL,
    "secuenciaFinal" INTEGER NOT NULL,
    "vigenciaHasta" TIMESTAMP(3) NOT NULL,
    "umbralAlerta" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ncf_plataforma_pkey" PRIMARY KEY ("id")
);
