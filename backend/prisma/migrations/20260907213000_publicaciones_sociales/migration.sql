-- CreateEnum
CREATE TYPE "EstadoPublicacionSocial" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "plantillas_publicacion_social" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantillas_publicacion_social_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publicaciones_sociales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "imagen" TEXT NOT NULL,
    "estado" "EstadoPublicacionSocial" NOT NULL DEFAULT 'BORRADOR',
    "creadoPorId" TEXT NOT NULL,
    "aprobadoPorId" TEXT,
    "motivoRechazo" TEXT,
    "fechaResolucion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publicaciones_sociales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plantillas_publicacion_social_clave_key" ON "plantillas_publicacion_social"("clave");

-- AddForeignKey
ALTER TABLE "publicaciones_sociales" ADD CONSTRAINT "publicaciones_sociales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_sociales" ADD CONSTRAINT "publicaciones_sociales_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_sociales" ADD CONSTRAINT "publicaciones_sociales_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_publicacion_social"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_sociales" ADD CONSTRAINT "publicaciones_sociales_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones_sociales" ADD CONSTRAINT "publicaciones_sociales_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
