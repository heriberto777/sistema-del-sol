process.env.ENCRYPTION_KEY = 'clave-de-prueba';
process.env.WHATSAPP_WEBHOOK_URL = 'https://app.ciguadev.com/api/webhooks/whatsapp/inbound';

import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { WhatsappBandejaService } from './whatsapp-bandeja.service';
import { WhatsappMensajesAdminRepository } from './whatsapp-mensajes-admin.repository';
import { WhatsappConfigRepository } from '../whatsapp-config/whatsapp-config.repository';
import { ProductosService } from '../productos/productos.service';
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
  let productosService: jest.Mocked<ProductosService>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    whatsappMensajesRepository = {
      listarPendientes: jest.fn(),
      obtenerConversacion: jest.fn(),
      crearRespuestaManual: jest.fn(),
      marcarAtendidosPorTelefono: jest.fn(),
    } as unknown as jest.Mocked<WhatsappMensajesAdminRepository>;
    whatsappConfigRepository = { obtenerOCrear: jest.fn().mockResolvedValue(CONFIG_BASE) } as unknown as jest.Mocked<WhatsappConfigRepository>;
    productosService = { buscarPorId: jest.fn() } as unknown as jest.Mocked<ProductosService>;
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    service = new WhatsappBandejaService(whatsappMensajesRepository, whatsappConfigRepository, productosService);
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

    it('con productoId: arma la mediaUrl del endpoint público y la manda a Twilio', async () => {
      productosService.buscarPorId.mockResolvedValue({ id: 'p1', nombre: 'Yogurt Fresa', imagen: 'data:image/png;base64,abc' } as never);

      await service.responder('t1', 'whatsapp:+18095551234', 'Mirá esto', 'p1');

      expect(fetchMock).toHaveBeenCalled();
      const [, opciones] = fetchMock.mock.calls[0];
      const body = opciones.body as URLSearchParams;
      expect(body.get('MediaUrl')).toBe('https://app.ciguadev.com/api/public/productos/p1/imagen');
    });

    it('con productoId: ignora el "contenido" del frontend y arma el caption con los datos reales del producto (sin precio)', async () => {
      productosService.buscarPorId.mockResolvedValue({
        id: 'p1',
        nombre: 'Yogurt Fresa',
        imagen: 'data:image/png;base64,abc',
        categoria: { nombre: 'Lácteos' },
        descripcionTienda: 'Yogurt natural sabor fresa.',
      } as never);

      await service.responder('t1', 'whatsapp:+18095551234', 'Mirá esto', 'p1');

      const [, opciones] = fetchMock.mock.calls[0];
      const body = opciones.body as URLSearchParams;
      expect(body.get('Body')).toBe('Yogurt Fresa\nCategoría: Lácteos\nYogurt natural sabor fresa.');
      expect(whatsappMensajesRepository.crearRespuestaManual).toHaveBeenCalledWith(
        't1',
        'whatsapp:+18095551234',
        'Yogurt Fresa\nCategoría: Lácteos\nYogurt natural sabor fresa.',
        expect.any(String),
      );
    });

    it('con productoId sin categoría ni descripción: el caption queda solo con el nombre', async () => {
      productosService.buscarPorId.mockResolvedValue({ id: 'p1', nombre: 'Yogurt Fresa', imagen: 'data:image/png;base64,abc' } as never);

      await service.responder('t1', 'whatsapp:+18095551234', 'Mirá esto', 'p1');

      const [, opciones] = fetchMock.mock.calls[0];
      const body = opciones.body as URLSearchParams;
      expect(body.get('Body')).toBe('Yogurt Fresa');
    });

    it('con productoId sin imagen cargada: rechaza sin llamar a Twilio', async () => {
      productosService.buscarPorId.mockResolvedValue({ id: 'p1', imagen: null } as never);

      await expect(service.responder('t1', 'whatsapp:+18095551234', 'Mirá esto', 'p1')).rejects.toThrow(BadRequestException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('con productoId pero sin WHATSAPP_WEBHOOK_URL configurada: rechaza', async () => {
      const original = process.env.WHATSAPP_WEBHOOK_URL;
      delete process.env.WHATSAPP_WEBHOOK_URL;
      productosService.buscarPorId.mockResolvedValue({ id: 'p1', imagen: 'data:image/png;base64,abc' } as never);

      await expect(service.responder('t1', 'whatsapp:+18095551234', 'Mirá esto', 'p1')).rejects.toThrow(ServiceUnavailableException);

      process.env.WHATSAPP_WEBHOOK_URL = original;
    });
  });

  describe('obtenerConversacion', () => {
    it('delega en el repositorio', async () => {
      await service.obtenerConversacion('whatsapp:+18095551234');
      expect(whatsappMensajesRepository.obtenerConversacion).toHaveBeenCalledWith('whatsapp:+18095551234');
    });
  });

  describe('marcarAtendido', () => {
    it('delega en el repositorio', async () => {
      await service.marcarAtendido('whatsapp:+18095551234');
      expect(whatsappMensajesRepository.marcarAtendidosPorTelefono).toHaveBeenCalledWith('whatsapp:+18095551234');
    });
  });
});
