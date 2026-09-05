-- AlterTable
ALTER TABLE "plataforma_configuracion" ADD COLUMN     "iaImagenProveedorActivo" TEXT DEFAULT 'claude',
ADD COLUMN     "iaClaudeApiKeyCifrado" TEXT,
ADD COLUMN     "iaOpenaiApiKeyCifrado" TEXT,
ADD COLUMN     "iaGeminiApiKeyCifrado" TEXT;
