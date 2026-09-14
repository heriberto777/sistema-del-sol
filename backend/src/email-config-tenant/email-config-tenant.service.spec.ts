import { EmailConfigTenantService } from './email-config-tenant.service';
import { EmailConfigTenantRepository } from './email-config-tenant.repository';
import { cifrar } from '../common/utils/encriptado.util';

const CONFIG_VACIA = {
  id: 'e1',
  tenantId: 't1',
  createdAt: new Date(),
  updatedAt: new Date(),
  habilitado: false,
  smtpHost: null,
  smtpPort: null,
  smtpUser: null,
  smtpPasswordCifrado: null,
  smtpFrom: null,
};

describe('EmailConfigTenantService', () => {
  let service: EmailConfigTenantService;
  let repo: jest.Mocked<EmailConfigTenantRepository>;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba';
    repo = {
      obtenerOCrear: jest.fn().mockResolvedValue(CONFIG_VACIA),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<EmailConfigTenantRepository>;
    service = new EmailConfigTenantService(repo);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  describe('obtener', () => {
    it('nunca expone la contraseña en texto plano — solo si está configurada', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, smtpPasswordCifrado: cifrar('clave_real') } as never);

      const resultado = await service.obtener('t1');

      expect(resultado.smtpPasswordConfigurado).toBe(true);
      expect(JSON.stringify(resultado)).not.toContain('clave_real');
    });

    it('reporta smtpPasswordConfigurado:false cuando no hay nada guardado', async () => {
      const resultado = await service.obtener('t1');
      expect(resultado.smtpPasswordConfigurado).toBe(false);
    });

    it('crea la fila con defaults si el tenant no tiene una todavía', async () => {
      await service.obtener('t1');
      expect(repo.obtenerOCrear).toHaveBeenCalledWith('t1');
    });
  });

  describe('actualizar', () => {
    it('cifra la contraseña nueva antes de guardarla', async () => {
      repo.actualizar.mockResolvedValue({ ...CONFIG_VACIA, smtpPasswordCifrado: 'cifrado' } as never);

      await service.actualizar('t1', { smtpPassword: 'clave_real' });

      const data = repo.actualizar.mock.calls[0][1] as { smtpPasswordCifrado: string };
      expect(data.smtpPasswordCifrado).toBeDefined();
      expect(data.smtpPasswordCifrado).not.toBe('clave_real');
    });

    it('"" borra el override guardado', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { smtpPassword: '' });

      const data = repo.actualizar.mock.calls[0][1] as { smtpPasswordCifrado: null };
      expect(data.smtpPasswordCifrado).toBeNull();
    });

    it('omitido no toca la contraseña ya guardada', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { smtpHost: 'smtp.tenant.com' });

      const data = repo.actualizar.mock.calls[0][1] as Record<string, unknown>;
      expect(data.smtpPasswordCifrado).toBeUndefined();
      expect(data.smtpHost).toBe('smtp.tenant.com');
    });
  });
});
