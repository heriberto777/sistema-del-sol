-- AlterTable
ALTER TABLE "propiedades" ADD COLUMN     "proyectoPreventaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "propiedades_proyectoPreventaId_key" ON "propiedades"("proyectoPreventaId");

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_proyectoPreventaId_fkey" FOREIGN KEY ("proyectoPreventaId") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
