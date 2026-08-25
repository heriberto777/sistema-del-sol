process.env.ENCRYPTION_KEY = 'clave-de-prueba';

import { ServiceUnavailableException } from '@nestjs/common';
import { WhatsappBandejaService } from './whatsapp-bandeja.service';
import { WhatsappMensajesAdminRepository } from './whatsapp-mensajes-admin.repository';
import { WhatsappConfigRepository } from '../whatsapp-config/whatsapp-config.repository';
import { cifrar } from '../common/utils/encriptado.util';

const CONFIG_BASE = {
  id: 'w1',
  tenantId: 't1',
  twilioAccountSid: 'ACxxx',
  twilioAuthTokenCifrado: cifrar('twilio-auth-token'),
  twilioWhatsappFrom: '+14155238886',
};

describe('WhatsappBandejaService', () => {
  let service: WhatsappBandejaService;
  let whatsappMensajesRepository: jest.Mocked<WhatsappMensajesAdminRepository>;
  let whatsappConfigRepository: jest.Mocked<WhatsappConfigRepository>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    whatsappMensajesRepository = {
      listarPendientes: jest.fn(),
      crearRespuestaManual: jest.fn(),
      marcarAtendidosPorTelefono: jest.fn(),
    } as unknown as jest.Mocked<WhatsappMensajesAdminRepository>;
    whatsappConfigRepository = { obtenerOCrear: jest.fn().mockResolvedValue(CONFIG_BASE) } as unknown as jest.Mocked<WhatsappConfigRepository>;
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    service = new WhatsappBandejaService(whatsappMensajesRepository, whatsappConfigRepository);
  });

  describe('responder', () => {
    it('rechaza si el tenant no tiene credenciales de Twilio', async () => {
      whatsappConfigRepository.obtenerOCrear.mockResolvedValue({ ...CONFIG_BASE, twilioAccountSid: null } as never);

      await expect(service.responder('t1', 'whatsapp:+18095551234', 'hola')).rejects.toThrow(ServiceUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('envía por Twilio, persiste como rol HUMANO y marca atendidos los pendientes de ese teléfono', async () => {
      await service.responder('t1', 'whatsapp:+18095551234', 'Ya te ayudamos con eso');

      expect(fetchMock).toHaveBeenCalled();
      expect(whatsappMensajesRepository.crearRespuestaManual).toHaveBeenCalledWith('t1', 'whatsapp:+18095551234', 'Ya te ayudamos con eso', expect.any(String));
      expect(whatsappMensajesRepository.marcarAtendidosPorTelefono).toHaveBeenCalledWith('whatsapp:+18095551234');
    });

    it('lanza si Twilio responde con error, sin marcar atendido', async () => {
      fetchMock.mockResolvedValue({ ok: false });

      await expect(service.responder('t1', 'whatsapp:+18095551234', 'hola')).rejects.toThrow(ServiceUnavailableException);
      expect(whatsappMensajesRepository.marcarAtendidosPorTelefono).not.toHaveBeenCalled();
    });
  });

  describe('marcarAtendido', () => {
    it('delega en el repositorio', async () => {
      await service.marcarAtendido('whatsapp:+18095551234');
      expect(whatsappMensajesRepository.marcarAtendidosPorTelefono).toHaveBeenCalledWith('whatsapp:+18095551234');
    });
  });
});
