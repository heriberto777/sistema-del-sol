-- AlterEnum
ALTER TYPE "EstadoPublicacionSocial" ADD VALUE 'CAMBIOS_SOLICITADOS';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telefono" TEXT;

-- AlterTable
ALTER TABLE "whatsapp_config_tenant" ADD COLUMN     "twilioTemplateAprobacionSid" TEXT;

-- CreateTable
CREATE TABLE "publicaciones_sociales_versiones" (
    "id" TEXT NOT NULL,
    "publicacionSocialId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "imagen" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "origen" "OrigenImagenPublicacionSocial" NOT NULL,
    "promptIa" TEXT,
    "formato" "FormatoPublicacionSocial" NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "comentarioCambios" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publicaciones_sociales_versiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "publicaciones_sociales_versiones_publicacionSocialId_numero_key" ON "publicaciones_sociales_versiones"("publicacionSocialId", "numero");

-- AddForeignKey
ALTER TABLE "publicaciones_sociales_versiones" ADD CONSTRAINT "publicaciones_sociales_versiones_publicacionSocialId_fkey" FOREIGN KEY ("publicacionSocialId") REFERENCES "publicaciones_sociales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_sociales_versiones" ADD CONSTRAINT "publicaciones_sociales_versiones_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_publicacion_social"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_sociales_versiones" ADD CONSTRAINT "publicaciones_sociales_versiones_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
