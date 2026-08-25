process.env.ENCRYPTION_KEY = 'clave-de-prueba';

import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappMensajesRepository } from './whatsapp-mensajes.repository';
import { IaClientService } from '../ia/ia-client.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { cifrar } from '../common/utils/encriptado.util';

const CONFIG_BASE = {
  id: 'w1',
  tenantId: 't1',
  twilioAccountSid: 'ACxxx',
  twilioAuthTokenCifrado: cifrar('twilio-auth-token'),
  twilioWhatsappFrom: '+14155238886',
  iaModelo: null,
  iaApiKeyCifrado: cifrar('sk-ant-tenant'),
  iaPromptNegocio: 'Horario: L-V 9am-5pm.',
  historialMensajes: 10,
  limiteRespuestasDiarias: 50,
};

const MENSAJE_ENTRANTE = { id: 'm1', tenantId: 't1', telefono: 'whatsapp:+18095551234', rol: 'USUARIO', contenido: 'hola', diaRD: '2026-08-25' };

describe('WhatsappBotService', () => {
  let service: WhatsappBotService;
  let prisma: { whatsappConfigTenant: { findUnique: jest.Mock }; whatsappMensaje: { update: jest.Mock } };
  let whatsappMensajesRepository: jest.Mocked<WhatsappMensajesRepository>;
  let iaClientService: jest.Mocked<IaClientService>;
  let eventBus: jest.Mocked<EventBusService>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    prisma = {
      whatsappConfigTenant: { findUnique: jest.fn() },
      whatsappMensaje: { update: jest.fn() },
    };
    whatsappMensajesRepository = {
      crear: jest.fn().mockResolvedValue(MENSAJE_ENTRANTE),
      contarRespuestasHoy: jest.fn().mockResolvedValue(0),
      historialReciente: jest.fn().mockResolvedValue([MENSAJE_ENTRANTE]),
    } as unknown as jest.Mocked<WhatsappMensajesRepository>;
    iaClientService = {
      completarConversacion: jest.fn().mockResolvedValue('{"respuesta":"Hola, en qué te ayudo?","requiereHumano":false}'),
    } as unknown as jest.Mocked<IaClientService>;
    eventBus = { emit: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    service = new WhatsappBotService(prisma as never, whatsappMensajesRepository, iaClientService, eventBus);
  });

  describe('procesarMensajeEntrante', () => {
    it('responde con IA y no emite el evento cuando requiereHumano es false', async () => {
      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(iaClientService.completarConversacion).toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalled(); // enviarWhatsappTwilio
    });

    it('usa la apiKey descifrada del tenant, no una de plataforma', async () => {
      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(iaClientService.completarConversacion).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ apiKey: 'sk-ant-tenant' }));
    });

    it('incluye el iaPromptNegocio del tenant en el system prompt', async () => {
      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      const [, opciones] = iaClientService.completarConversacion.mock.calls[0];
      expect(opciones?.system).toContain('Horario: L-V 9am-5pm.');
    });

    it('tope diario alcanzado: no llama a la IA, marca requiereHumano y emite el evento', async () => {
      whatsappMensajesRepository.contarRespuestasHoy.mockResolvedValue(50);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(iaClientService.completarConversacion).not.toHaveBeenCalled();
      expect(prisma.whatsappMensaje.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { requiereAtencionHumana: true } });
      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.WHATSAPP_REQUIERE_ATENCION, expect.objectContaining({ tenantId: 't1' }));
    });

    it('sin iaApiKeyCifrado configurada: no llama a la IA y escala a humano', async () => {
      await service.procesarMensajeEntrante({ ...CONFIG_BASE, iaApiKeyCifrado: null }, 'whatsapp:+18095551234', 'hola');

      expect(iaClientService.completarConversacion).not.toHaveBeenCalled();
      expect(eventBus.emit).toHaveBeenCalled();
    });

    it('JSON inválido de la IA: fail-safe a requiereHumano con una respuesta genérica', async () => {
      iaClientService.completarConversacion.mockResolvedValue('esto no es JSON');

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(eventBus.emit).toHaveBeenCalled();
      const llamadaCrear = whatsappMensajesRepository.crear.mock.calls.find((c) => c[0].rol === 'ASISTENTE');
      expect(llamadaCrear?.[0].contenido).toMatch(/conectarte con alguien del equipo/i);
    });

    it('la IA sin respuesta (null): fail-safe a requiereHumano', async () => {
      iaClientService.completarConversacion.mockResolvedValue(null);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(eventBus.emit).toHaveBeenCalled();
    });

    it('respeta requiereHumano:true devuelto por la IA aunque haya respondido bien', async () => {
      iaClientService.completarConversacion.mockResolvedValue('{"respuesta":"Dejame conectarte con soporte","requiereHumano":true}');

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.WHATSAPP_REQUIERE_ATENCION, expect.objectContaining({ telefono: 'whatsapp:+18095551234' }));
    });

    it('pasa el historial reciente (sin el mensaje entrante duplicado) como mensajes a la IA', async () => {
      whatsappMensajesRepository.historialReciente.mockResolvedValue([
        { ...MENSAJE_ENTRANTE, id: 'm0', rol: 'ASISTENTE', contenido: 'Hola, bienvenido' } as never,
        MENSAJE_ENTRANTE as never,
      ]);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      const [mensajes] = iaClientService.completarConversacion.mock.calls[0];
      expect(mensajes).toEqual([
        { role: 'assistant', content: 'Hola, bienvenido' },
        { role: 'user', content: 'hola' },
      ]);
    });
  });

  describe('verificarFirma', () => {
    it('rechaza si el tenant no tiene twilioAuthTokenCifrado', () => {
      expect(service.verificarFirma({ twilioAuthTokenCifrado: null }, 'https://x.com', {}, 'firma')).toBe(false);
    });
  });

  describe('resolverConfigPorNumero', () => {
    it('normaliza el prefijo whatsapp: antes de buscar', async () => {
      prisma.whatsappConfigTenant.findUnique.mockResolvedValue(CONFIG_BASE);

      await service.resolverConfigPorNumero('whatsapp:+14155238886');

      expect(prisma.whatsappConfigTenant.findUnique).toHaveBeenCalledWith({ where: { twilioWhatsappFrom: '+14155238886' } });
    });
  });
});
