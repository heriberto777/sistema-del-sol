import { ServiceUnavailableException } from '@nestjs/common';
import { AnalizadorImagenService } from './analizador-imagen.service';
import { ClaudeVisionAdapter } from './claude-vision.adapter';
import { OpenAiVisionAdapter } from './openai-vision.adapter';
import { GeminiVisionAdapter } from './gemini-vision.adapter';

describe('AnalizadorImagenService', () => {
  let service: AnalizadorImagenService;
  let claudeAdapter: jest.Mocked<ClaudeVisionAdapter>;
  let openAiAdapter: jest.Mocked<OpenAiVisionAdapter>;
  let geminiAdapter: jest.Mocked<GeminiVisionAdapter>;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    claudeAdapter = { clave: 'claude', habilitado: true, analizar: jest.fn().mockResolvedValue([{ nombre: 'X', descripcion: 'Y' }]) } as unknown as jest.Mocked<ClaudeVisionAdapter>;
    openAiAdapter = { clave: 'openai', habilitado: true, analizar: jest.fn().mockResolvedValue([{ nombre: 'X', descripcion: 'Y' }]) } as unknown as jest.Mocked<OpenAiVisionAdapter>;
    geminiAdapter = { clave: 'gemini', habilitado: true, analizar: jest.fn().mockResolvedValue([{ nombre: 'X', descripcion: 'Y' }]) } as unknown as jest.Mocked<GeminiVisionAdapter>;
    service = new AnalizadorImagenService(claudeAdapter, openAiAdapter, geminiAdapter);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  describe('activo', () => {
    it('sin IA_IMAGEN_PROVEEDOR_ACTIVO, cae a Claude', () => {
      delete process.env.IA_IMAGEN_PROVEEDOR_ACTIVO;
      expect(service.activo).toBe(claudeAdapter);
    });

    it('resuelve OpenAI cuando IA_IMAGEN_PROVEEDOR_ACTIVO=openai', () => {
      process.env.IA_IMAGEN_PROVEEDOR_ACTIVO = 'openai';
      expect(service.activo).toBe(openAiAdapter);
    });

    it('resuelve Gemini cuando IA_IMAGEN_PROVEEDOR_ACTIVO=gemini', () => {
      process.env.IA_IMAGEN_PROVEEDOR_ACTIVO = 'gemini';
      expect(service.activo).toBe(geminiAdapter);
    });

    it('un valor desconocido cae a Claude en vez de romper', () => {
      process.env.IA_IMAGEN_PROVEEDOR_ACTIVO = 'algo-que-no-existe';
      expect(service.activo).toBe(claudeAdapter);
    });
  });

  describe('analizarDesdeDataUri', () => {
    it('separa mimeType/base64 de la data URI y delega en el adaptador activo', async () => {
      process.env.IA_IMAGEN_PROVEEDOR_ACTIVO = 'openai';
      const resultado = await service.analizarDesdeDataUri('data:image/png;base64,YWJj');
      expect(openAiAdapter.analizar).toHaveBeenCalledWith('YWJj', 'image/png');
      expect(resultado).toEqual([{ nombre: 'X', descripcion: 'Y' }]);
    });

    it('rechaza una data URI con formato inválido sin llamar a ningún adaptador', async () => {
      await expect(service.analizarDesdeDataUri('no-es-una-data-uri')).rejects.toThrow(ServiceUnavailableException);
      expect(claudeAdapter.analizar).not.toHaveBeenCalled();
    });

    it('rechaza si el proveedor activo no está habilitado (sin API key configurada)', async () => {
      (claudeAdapter as { habilitado: boolean }).habilitado = false;
      await expect(service.analizarDesdeDataUri('data:image/jpeg;base64,YWJj')).rejects.toThrow(ServiceUnavailableException);
      expect(claudeAdapter.analizar).not.toHaveBeenCalled();
    });
  });
});
