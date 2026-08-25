import { BadRequestException } from '@nestjs/common';
import { PasarelaCobroConfigService } from './pasarela-cobro-config.service';
import { PasarelaCobroConfigRepository } from './pasarela-cobro-config.repository';
import { cifrar } from '../common/utils/encriptado.util';

const CONFIG_VACIA = {
  id: 'p1',
  tenantId: 't1',
  createdAt: new Date(),
  updatedAt: new Date(),
  pasarelaActiva: null,
  azulMerchantId: null,
  azulMerchantName: null,
  azulCurrencyCode: '$',
  azulAuthKeyCifrado: null,
  cardnetMerchantNumber: null,
  cardnetMerchantTerminal: null,
  cardnetMerchantTerminalAmex: null,
  cardnetMerchantName: null,
  cardnetMerchantType: null,
  cardnetAcquiringInstitutionCode: null,
};

describe('PasarelaCobroConfigService', () => {
  let service: PasarelaCobroConfigService;
  let repo: jest.Mocked<PasarelaCobroConfigRepository>;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba';
    repo = {
      obtenerOCrear: jest.fn().mockResolvedValue(CONFIG_VACIA),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<PasarelaCobroConfigRepository>;
    service = new PasarelaCobroConfigService(repo);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  describe('obtener', () => {
    it('nunca expone un secreto en texto plano — solo si está configurado', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, azulAuthKeyCifrado: cifrar('auth-key-real') } as never);

      const resultado = await service.obtener('t1');

      expect(resultado.azul.authKeyConfigurado).toBe(true);
      expect(JSON.stringify(resultado)).not.toContain('auth-key-real');
    });

    it('reporta configurado:false cuando no hay nada guardado', async () => {
      const resultado = await service.obtener('t1');
      expect(resultado.azul.authKeyConfigurado).toBe(false);
      expect(resultado.cardnet.merchantNumber).toBeNull();
    });
  });

  describe('actualizar', () => {
    it('cifra un secreto nuevo antes de guardarlo', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { azulAuthKey: 'auth-key-nuevo' });

      const [, data] = repo.actualizar.mock.calls[0];
      expect((data as { azulAuthKeyCifrado?: string }).azulAuthKeyCifrado).not.toBe('auth-key-nuevo');
      expect((data as { azulAuthKeyCifrado?: string }).azulAuthKeyCifrado).toEqual(expect.any(String));
    });

    it('"" borra el override guardado (queda null)', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { azulAuthKey: '' });

      const [, data] = repo.actualizar.mock.calls[0];
      expect((data as { azulAuthKeyCifrado?: string | null }).azulAuthKeyCifrado).toBeNull();
    });

    it('actualiza los campos de CardNet (sin secreto que cifrar)', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { cardnetMerchantNumber: '349011300', cardnetMerchantTerminal: '00567856', cardnetMerchantType: '5440' });

      const [, data] = repo.actualizar.mock.calls[0];
      expect(data).toEqual(
        expect.objectContaining({ cardnetMerchantNumber: '349011300', cardnetMerchantTerminal: '00567856', cardnetMerchantType: '5440' }),
      );
    });

    it('omitir un campo no lo toca', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { azulMerchantId: '12345' });

      const [, data] = repo.actualizar.mock.calls[0];
      expect(data).not.toHaveProperty('azulAuthKeyCifrado');
      expect((data as { azulMerchantId?: string }).azulMerchantId).toBe('12345');
    });

    it('rechaza con 400 si falta ENCRYPTION_KEY al guardar un secreto', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(service.actualizar('t1', { azulAuthKey: 'x' })).rejects.toThrow(BadRequestException);
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('permite elegir/limpiar la pasarela activa', async () => {
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t1', { pasarelaActiva: 'AZUL' });
      expect(repo.actualizar.mock.calls[0][1]).toEqual(expect.objectContaining({ pasarelaActiva: 'AZUL' }));

      await service.actualizar('t1', { pasarelaActiva: null });
      expect(repo.actualizar.mock.calls[1][1]).toEqual(expect.objectContaining({ pasarelaActiva: null }));
    });

    it('actualiza sobre la fila del tenant correcto', async () => {
      repo.obtenerOCrear.mockResolvedValue({ ...CONFIG_VACIA, id: 'p-tenant-2' } as never);
      repo.actualizar.mockResolvedValue(CONFIG_VACIA as never);

      await service.actualizar('t2', { pasarelaActiva: 'CARDNET' });

      expect(repo.obtenerOCrear).toHaveBeenCalledWith('t2');
      expect(repo.actualizar).toHaveBeenCalledWith('p-tenant-2', expect.objectContaining({ pasarelaActiva: 'CARDNET' }));
    });
  });
});
