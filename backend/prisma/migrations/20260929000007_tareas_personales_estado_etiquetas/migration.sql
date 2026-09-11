-- AlterEnum
ALTER TYPE "EstadoTareaPersonal" ADD VALUE 'EN_ESPERA';

-- AlterTable
-- DEFAULT solo para rellenar las filas ya existentes — se quita después
-- para que la columna quede igual a como Prisma la declara en el resto
-- del schema (@updatedAt no lleva default propio, Prisma manda el valor
-- en cada escritura).
ALTER TABLE "comentarios_tarea_personal" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "comentarios_tarea_personal" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tareas_personales" ADD COLUMN     "etiquetas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "tareas_personales" ALTER COLUMN "etiquetas" DROP DEFAULT;
