-- CreateEnum
CREATE TYPE "TipoDocumentoImpreso" AS ENUM ('FACTURA', 'COTIZACION', 'REMISION');

-- CreateEnum
CREATE TYPE "QrContenido" AS ENUM ('LINK_PAGO', 'TEXTO_LIBRE');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "colorAcentoDocumentos" TEXT;

-- CreateTable
CREATE TABLE "personalizaciones_documento_tipo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumentoImpreso" NOT NULL,
    "camposEmisorVisibles" TEXT[],
    "camposClienteVisibles" TEXT[],
    "columnasLinea" TEXT[],
    "totalesVisibles" TEXT[],
    "textoLegal" TEXT,
    "qrHabilitado" BOOLEAN NOT NULL DEFAULT false,
    "qrContenido" "QrContenido",
    "qrValor" TEXT,
    "firmaHabilitada" BOOLEAN NOT NULL DEFAULT false,
    "firmaEtiqueta" TEXT,
    "firmaImagen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personalizaciones_documento_tipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personalizaciones_documento_tipo_tenantId_tipoDocumento_key" ON "personalizaciones_documento_tipo"("tenantId", "tipoDocumento");

-- AddForeignKey
ALTER TABLE "personalizaciones_documento_tipo" ADD CONSTRAINT "personalizaciones_documento_tipo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
