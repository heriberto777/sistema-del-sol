-- CreateEnum
CREATE TYPE "CicloFacturacion" AS ENUM ('MENSUAL', 'ANUAL');

-- AlterTable
ALTER TABLE "planes" ADD COLUMN     "cicloFacturacion" "CicloFacturacion" NOT NULL DEFAULT 'MENSUAL',
ADD COLUMN     "precio" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "platform_admins" ADD COLUMN     "roleId" TEXT;

-- CreateTable
CREATE TABLE "platform_permissions" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,

    CONSTRAINT "platform_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_roles" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "platform_role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_permissions_clave_key" ON "platform_permissions"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "platform_roles_nombre_key" ON "platform_roles"("nombre");

-- AddForeignKey
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "platform_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "platform_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "platform_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

