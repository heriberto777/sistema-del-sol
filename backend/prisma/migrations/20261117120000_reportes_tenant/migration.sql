-- CreateEnum
CREATE TYPE "CategoriaReporteTenant" AS ENUM ('BUG', 'DUDA', 'SOLICITUD', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoReporteTenant" AS ENUM ('NUEVO', 'EN_REVISION', 'RESUELTO');

-- CreateTable
CREATE TABLE "reportes_tenant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" "CategoriaReporteTenant" NOT NULL,
    "estado" "EstadoReporteTenant" NOT NULL DEFAULT 'NUEVO',
    "respuesta" TEXT,
    "respondidoPorId" TEXT,
    "respondidoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportes_tenant_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "reportes_tenant" ADD CONSTRAINT "reportes_tenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_tenant" ADD CONSTRAINT "reportes_tenant_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_tenant" ADD CONSTRAINT "reportes_tenant_respondidoPorId_fkey" FOREIGN KEY ("respondidoPorId") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
