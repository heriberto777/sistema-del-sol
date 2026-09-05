-- AlterTable
ALTER TABLE "plataforma_configuracion" ADD COLUMN     "iaClaudeModelo" TEXT DEFAULT 'claude-sonnet-5',
ADD COLUMN     "iaOpenaiModelo" TEXT DEFAULT 'gpt-4o',
ADD COLUMN     "iaGeminiModelo" TEXT DEFAULT 'gemini-2.0-flash';
