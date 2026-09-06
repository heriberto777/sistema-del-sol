import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { WhatsappConfigService } from './whatsapp-config.service';
import { WhatsappConfigRepository } from './whatsapp-config.repository';
import { ConversacionIaService } from '../ia/conversacion/conversacion-ia.service';
import { cifrar } from '../common/utils/encriptado.util';

const CONFIG_VACIA = {
  id: 'w1',
  tenantId: 't1',
  createdAt: new Date(),
  updatedAt: new Date(),
  habilitado: false,
  twilioAccountSid: null,
  twilioAuthTokenCifrado: null,
  twilioWhatsappFrom: null,
  iaProveedor: null,
  iaModelo: null,
  iaApiKeyCifrado: null,
  historialMensajes: 10,
  iaPromptNegocio: null,
  limiteRespuestasDiarias: 50,
};

describe('WhatsappConfigService', () => {
  let service: WhatsappConfigService;
  let repo: jest.Mocked<WhatsappConfigRepository>;
  let conversacionIaService: jest.Mocked<ConversacionIaService>;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba';
    repo = {
      obtenerOCrear: jest.fn().mockResolvedValue(CONFIG_VACIA),
      actualizar: jest.fn(),
      obtenerContextoNegocio: jest.fn().mockResolvedValue({ nombre: 'Emelinda dCloset', direccion: null, categorias: [], productos: [] }),
    } as unknown as jest.Mocked<WhatsappConfigRepository>;
    conversacionIaService = {
      listarModelos: jest.fn().mockResolvedValue([{ id: 'claude-sonnet-5', nombre: 'Claude Sonnet 5' }]),
      completar: jest.fn().mockResolvedValue('Somos una tienda de ropa…'),
    } as unknown as jest.Mocked<ConversacionIaService>;
    service = new WhatsappConfigService(repo, conversacionIaService);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  describe('obtener', () => {
    it('nunca expone un secreto en texto plano — solo si está configurado', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, twilioAuthTokenCifrado: cifrar('token_real') } as never);

      const resultado = await service.obtener('t1');

      expect(resultado.twilioAuthTokenConfigurado).toBe(true);
      expect(JSON.stringify(resultado)).not.toContain('token_real');
    });

    it('reporta configurado:false cuando no hay nada guardado', async () => {
      const resultado = await service.obtener('t1');
      expect(resultado.twilioAuthTokenConfigurado).toBe(false);
      expect(resultado.iaApiKeyConfigurado).toBe(false);
    });

    it('crea la fila con defaults si el tenant no tiene una todavía', async () => {
      await service.obtener('t1');
      expect(repo.obtenerOCrear).toHaveBeenCalledWith('t1');
    });
  });

  describe('actualizar', () => {
    it('cifra un secreto nuevo antes de guardarlo', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { twilioAuthToken: 'token_nuevo' });

      const [, data] = repo.actualizar.mock.calls[0];
      expect((data as { twilioAuthTokenCifrado?: string }).twilioAuthTokenCifrado).not.toBe('token_nuevo');
      expect((data as { twilioAuthTokenCifrado?: string }).twilioAuthTokenCifrado).toEqual(expect.any(String));
    });

    it('"" borra el override guardado (queda null)', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { iaApiKey: '' });

      const [, data] = repo.actualizar.mock.calls[0];
      expect((data as { iaApiKeyCifrado?: string | null }).iaApiKeyCifrado).toBeNull();
    });

    it('omitir un campo no lo toca', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { historialMensajes: 20 });

      const [, data] = repo.actualizar.mock.calls[0];
      expect(data).not.toHaveProperty('twilioAuthTokenCifrado');
      expect((data as { historialMensajes?: number }).historialMensajes).toBe(20);
    });

    it('actualiza iaPromptNegocio y limiteRespuestasDiarias (ítem H-2b)', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { iaPromptNegocio: 'Horario: 9am-5pm', limiteRespuestasDiarias: 25 });

      const [, data] = repo.actualizar.mock.calls[0];
      expect(data).toEqual(expect.objectContaining({ iaPromptNegocio: 'Horario: 9am-5pm', limiteRespuestasDiarias: 25 }));
    });

    it('rechaza con 400 si falta ENCRYPTION_KEY al guardar un secreto', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(service.actualizar('t1', { twilioAuthToken: 'token_x' })).rejects.toThrow(BadRequestException);
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('actualiza sobre la fila del tenant correcto', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, id: 'w-tenant-2' } as never);
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t2', { habilitado: true });

      expect(repo.obtenerOCrear).toHaveBeenCalledWith('t2');
      expect(repo.actualizar).toHaveBeenCalledWith('w-tenant-2', expect.objectContaining({ habilitado: true }));
    });
  });

  describe('listarModelos', () => {
    it('rechaza con 400 si el tenant todavía no guardó una API key', async () => {
      await expect(service.listarModelos('t1', 'ANTHROPIC')).rejects.toThrow(BadRequestException);
      expect(conversacionIaService.listarModelos).not.toHaveBeenCalled();
    });

    it('descifra la key ya guardada y se la pasa al proveedor elegido', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, iaApiKeyCifrado: cifrar('sk-ant-real') } as never);

      const resultado = await service.listarModelos('t1', 'ANTHROPIC');

      expect(resultado).toEqual([{ id: 'claude-sonnet-5', nombre: 'Claude Sonnet 5' }]);
      expect(conversacionIaService.listarModelos).toHaveBeenCalledWith('ANTHROPIC', 'sk-ant-real');
    });
  });

  describe('sugerirComportamiento', () => {
    it('rechaza con 400 si falta proveedor o API key configurados', async () => {
      await expect(service.sugerirComportamiento('t1')).rejects.toThrow(BadRequestException);
      expect(conversacionIaService.completar).not.toHaveBeenCalled();
    });

    it('arma el prompt con el contexto real del negocio y devuelve el texto generado', async () => {
      repo.obtenerOCrear.mockResolvedValue({
        ...CONFIG_VACIA,
        iaProveedor: 'ANTHROPIC',
        iaModelo: 'claude-sonnet-5',
        iaApiKeyCifrado: cifrar('sk-ant-real'),
      } as never);
      repo.obtenerContextoNegocio.mockResolvedValue({
        nombre: "Emelinda d'Closet",
        direccion: 'Av. Principal #123',
        categorias: ['Ropa', 'Zapatos'],
        productos: ['Camisa azul', 'Zapato deportivo'],
      });

      const resultado = await service.sugerirComportamiento('t1');

      expect(resultado).toEqual({ texto: 'Somos una tienda de ropa…' });
      const [proveedor, mensajes, opciones] = conversacionIaService.completar.mock.calls[0];
      expect(proveedor).toBe('ANTHROPIC');
      expect(mensajes[0].content).toContain("Emelinda d'Closet");
      expect(mensajes[0].content).toContain('Av. Principal #123');
      expect(mensajes[0].content).toContain('Ropa, Zapatos');
      expect(opciones).toEqual(expect.objectContaining({ apiKey: 'sk-ant-real', modelo: 'claude-sonnet-5' }));
    });

    it('lanza ServiceUnavailableException si la IA no devuelve texto', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, iaProveedor: 'ANTHROPIC', iaApiKeyCifrado: cifrar('sk-ant-real') } as never);
      conversacionIaService.completar.mockResolvedValue(null);

      await expect(service.sugerirComportamiento('t1')).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
