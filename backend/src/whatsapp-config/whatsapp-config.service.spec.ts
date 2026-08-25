import { BadRequestException } from '@nestjs/common';
import { WhatsappConfigService } from './whatsapp-config.service';
import { WhatsappConfigRepository } from './whatsapp-config.repository';
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
};

describe('WhatsappConfigService', () => {
  let service: WhatsappConfigService;
  let repo: jest.Mocked<WhatsappConfigRepository>;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba';
    repo = {
      obtenerOCrear: jest.fn().mockResolvedValue(CONFIG_VACIA),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<WhatsappConfigRepository>;
    service = new WhatsappConfigService(repo);
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
});
