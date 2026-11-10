-- CreateEnum
CREATE TYPE "TipoDocumentoComentario" AS ENUM ('FACTURA', 'COTIZACION');

-- CreateTable
CREATE TABLE "comentarios_documento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumentoComentario" NOT NULL,
    "documentoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "mencionadoId" TEXT,
    "fechaRecordatorio" TIMESTAMP(3),
    "recordatorioEnviado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comentarios_documento_tenantId_tipoDocumento_documentoId_idx" ON "comentarios_documento"("tenantId", "tipoDocumento", "documentoId");

-- AddForeignKey
ALTER TABLE "comentarios_documento" ADD CONSTRAINT "comentarios_documento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_documento" ADD CONSTRAINT "comentarios_documento_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_documento" ADD CONSTRAINT "comentarios_documento_mencionadoId_fkey" FOREIGN KEY ("mencionadoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
