-- DropForeignKey
ALTER TABLE "tenant_plugins" DROP CONSTRAINT "tenant_plugins_tenantId_fkey";

-- AlterTable
ALTER TABLE "tenants" DROP COLUMN "planBase",
ADD COLUMN     "planId" TEXT;

-- DropTable
DROP TABLE "tenant_plugins";

-- CreateTable
CREATE TABLE "modulos" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_modulos" (
    "planId" TEXT NOT NULL,
    "moduloId" TEXT NOT NULL,

    CONSTRAINT "plan_modulos_pkey" PRIMARY KEY ("planId","moduloId")
);

-- CreateTable
CREATE TABLE "tenant_modulo_overrides" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduloId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_modulo_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modulos_clave_key" ON "modulos"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "planes_nombre_key" ON "planes"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_modulo_overrides_tenantId_moduloId_key" ON "tenant_modulo_overrides"("tenantId", "moduloId");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_modulos" ADD CONSTRAINT "plan_modulos_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_modulos" ADD CONSTRAINT "plan_modulos_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "modulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modulo_overrides" ADD CONSTRAINT "tenant_modulo_overrides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modulo_overrides" ADD CONSTRAINT "tenant_modulo_overrides_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "modulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

