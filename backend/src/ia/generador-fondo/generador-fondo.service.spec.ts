import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { GeneradorFondoService } from './generador-fondo.service';
import { OpenAiFondoAdapter } from './openai-fondo.adapter';
import { GeminiFondoAdapter } from './gemini-fondo.adapter';

describe('GeneradorFondoService', () => {
  let service: GeneradorFondoService;
  let openAiAdapter: jest.Mocked<OpenAiFondoAdapter>;
  let geminiAdapter: jest.Mocked<GeminiFondoAdapter>;

  beforeEach(() => {
    delete process.env.IA_FONDO_PROVEEDOR_ACTIVO;
    openAiAdapter = { clave: 'openai', habilitado: true, generar: jest.fn(), listarModelos: jest.fn() } as unknown as jest.Mocked<OpenAiFondoAdapter>;
    geminiAdapter = { clave: 'gemini', habilitado: true, generar: jest.fn(), listarModelos: jest.fn() } as unknown as jest.Mocked<GeminiFondoAdapter>;
    service = new GeneradorFondoService(openAiAdapter, geminiAdapter);
  });

  describe('activo', () => {
    it('usa Gemini por defecto sin IA_FONDO_PROVEEDOR_ACTIVO', () => {
      expect(service.activo.clave).toBe('gemini');
    });

    it('respeta IA_FONDO_PROVEEDOR_ACTIVO=openai', () => {
      process.env.IA_FONDO_PROVEEDOR_ACTIVO = 'openai';
      expect(service.activo.clave).toBe('openai');
    });

    it('cae a Gemini si el valor no es un proveedor reconocido (ej. "claude")', () => {
      process.env.IA_FONDO_PROVEEDOR_ACTIVO = 'claude';
      expect(service.activo.clave).toBe('gemini');
    });
  });

  describe('generarDesdeDataUri', () => {
    it('rechaza un data URI con formato inválido', async () => {
      await expect(service.generarDesdeDataUri('no-es-un-data-uri', 'prompt', 'CUADRADO')).rejects.toThrow(BadRequestException);
      expect(geminiAdapter.generar).not.toHaveBeenCalled();
    });

    it('degrada con un error claro si el proveedor activo no tiene API key', async () => {
      const geminiSinKey = { clave: 'gemini', habilitado: false, generar: jest.fn(), listarModelos: jest.fn() } as unknown as jest.Mocked<GeminiFondoAdapter>;
      const servicioSinKey = new GeneradorFondoService(openAiAdapter, geminiSinKey);
      await expect(servicioSinKey.generarDesdeDataUri('data:image/png;base64,AAAA', 'prompt', 'CUADRADO')).rejects.toThrow(ServiceUnavailableException);
    });

    it('delega en el adapter activo y arma el data URI del resultado', async () => {
      geminiAdapter.generar.mockResolvedValue({ base64: 'RESULTADO', mimeType: 'image/png' });

      const resultado = await service.generarDesdeDataUri('data:image/jpeg;base64,AAAA', 'fondo de cocina', 'CUADRADO');

      expect(geminiAdapter.generar).toHaveBeenCalledWith('AAAA', 'image/jpeg', 'fondo de cocina', 'CUADRADO');
      expect(resultado).toBe('data:image/png;base64,RESULTADO');
    });

    it('Fase 4 — reenvía el formato VERTICAL al adapter', async () => {
      geminiAdapter.generar.mockResolvedValue({ base64: 'RESULTADO', mimeType: 'image/png' });

      await service.generarDesdeDataUri('data:image/jpeg;base64,AAAA', 'fondo de cocina', 'VERTICAL');

      expect(geminiAdapter.generar).toHaveBeenCalledWith('AAAA', 'image/jpeg', 'fondo de cocina', 'VERTICAL');
    });

    it('Fase 3 — pasa el logo (segunda imagen) al adapter cuando viene', async () => {
      geminiAdapter.generar.mockResolvedValue({ base64: 'RESULTADO', mimeType: 'image/png' });

      await service.generarDesdeDataUri('data:image/jpeg;base64,AAAA', 'fondo de cocina', 'CUADRADO', 'data:image/png;base64,LOGO');

      expect(geminiAdapter.generar).toHaveBeenCalledWith('AAAA', 'image/jpeg', 'fondo de cocina', 'CUADRADO', { base64: 'LOGO', mimeType: 'image/png' });
    });

    it('Fase 3 — ignora un logoDataUri con formato inválido en vez de romper toda la generación', async () => {
      geminiAdapter.generar.mockResolvedValue({ base64: 'RESULTADO', mimeType: 'image/png' });

      await service.generarDesdeDataUri('data:image/jpeg;base64,AAAA', 'fondo de cocina', 'CUADRADO', 'no-es-un-data-uri');

      expect(geminiAdapter.generar).toHaveBeenCalledWith('AAAA', 'image/jpeg', 'fondo de cocina', 'CUADRADO');
    });
  });

  describe('listarModelos', () => {
    it('rechaza un proveedor no reconocido', async () => {
      await expect(service.listarModelos('claude')).rejects.toThrow(BadRequestException);
    });

    it('delega en el adapter del proveedor pedido (no necesariamente el activo)', async () => {
      process.env.IA_FONDO_PROVEEDOR_ACTIVO = 'gemini';
      openAiAdapter.listarModelos.mockResolvedValue([{ id: 'gpt-image-1.5', nombre: 'gpt-image-1.5' }]);

      const modelos = await service.listarModelos('openai');

      expect(modelos).toEqual([{ id: 'gpt-image-1.5', nombre: 'gpt-image-1.5' }]);
    });
  });
});
