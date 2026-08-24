-- CreateTable
CREATE TABLE "puestos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puestos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "puestos_tenantId_nombre_key" ON "puestos"("tenantId", "nombre");

-- AlterTable
ALTER TABLE "empleados" ADD COLUMN "puestoId" TEXT;

-- AddForeignKey
ALTER TABLE "puestos" ADD CONSTRAINT "puestos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_puestoId_fkey" FOREIGN KEY ("puestoId") REFERENCES "puestos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
