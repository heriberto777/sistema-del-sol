-- Renglones de incentivo IT configurables por tenant, y descripción larga
-- + categoría opcional en TareaPersonal (ver comentarios en schema.prisma).

-- AlterTable
ALTER TABLE "tareas_personales" ADD COLUMN     "categoriaIncentivoId" TEXT,
ADD COLUMN     "descripcion" TEXT;

-- CreateTable
CREATE TABLE "categorias_incentivo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "peso" DECIMAL(12,2) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_incentivo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tareas_personales" ADD CONSTRAINT "tareas_personales_categoriaIncentivoId_fkey" FOREIGN KEY ("categoriaIncentivoId") REFERENCES "categorias_incentivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_incentivo" ADD CONSTRAINT "categorias_incentivo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
