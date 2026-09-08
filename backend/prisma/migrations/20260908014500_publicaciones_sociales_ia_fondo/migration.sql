-- CreateEnum
CREATE TYPE "OrigenImagenPublicacionSocial" AS ENUM ('FOTO_PRODUCTO', 'IA');

-- AlterTable
ALTER TABLE "plataforma_configuracion" ADD COLUMN     "iaFondoLimiteMensual" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "iaFondoProveedorActivo" TEXT DEFAULT 'gemini',
ADD COLUMN     "iaGeminiModeloFondo" TEXT DEFAULT 'gemini-3-pro-image-preview',
ADD COLUMN     "iaOpenaiModeloFondo" TEXT DEFAULT 'gpt-image-1.5';

-- AlterTable
ALTER TABLE "publicaciones_sociales" ADD COLUMN     "origen" "OrigenImagenPublicacionSocial" NOT NULL DEFAULT 'FOTO_PRODUCTO',
ADD COLUMN     "promptIa" TEXT;
