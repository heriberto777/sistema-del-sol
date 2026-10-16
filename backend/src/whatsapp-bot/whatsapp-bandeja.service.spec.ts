process.env.ENCRYPTION_KEY = 'clave-de-prueba';
process.env.WHATSAPP_WEBHOOK_URL = 'https://app.ciguadev.com/api/webhooks/whatsapp/inbound';

import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { WhatsappBandejaService } from './whatsapp-bandeja.service';
import { WhatsappMensajesAdminRepository } from './whatsapp-mensajes-admin.repository';
import { WhatsappConfigRepository } from '../whatsapp-config/whatsapp-config.repository';
import { ProductosService } from '../productos/productos.service';
import { ClientesService } from '../clientes/clientes.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
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
  let clientesService: jest.Mocked<ClientesService>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let cotizacionesService: jest.Mocked<CotizacionesService>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    whatsappMensajesRepository = {
      listarPendientes: jest.fn(),
      listarConversaciones: jest.fn(),
      obtenerConversacion: jest.fn(),
      crearRespuestaManual: jest.fn(),
      marcarAtendidosPorTelefono: jest.fn(),
    } as unknown as jest.Mocked<WhatsappMensajesAdminRepository>;
    whatsappConfigRepository = { obtenerOCrear: jest.fn().mockResolvedValue(CONFIG_BASE) } as unknown as jest.Mocked<WhatsappConfigRepository>;
    productosService = { buscarPorId: jest.fn() } as unknown as jest.Mocked<ProductosService>;
    clientesService = { estadoCuenta: jest.fn() } as unknown as jest.Mocked<ClientesService>;
    facturacionService = { buscarPorId: jest.fn() } as unknown as jest.Mocked<FacturacionService>;
    cotizacionesService = { buscarPorId: jest.fn(), listarRecientesPorCliente: jest.fn() } as unknown as jest.Mocked<CotizacionesService>;
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    service = new WhatsappBandejaService(
      whatsappMensajesRepository,
      whatsappConfigRepository,
      productosService,
      clientesService,
      facturacionService,
      cotizacionesService,
    );
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

  describe('enviarDocumento', () => {
    const PERMISOS_COMPLETOS = ['facturacion.ver', 'cotizaciones.ver', 'clientes.ver'];

    it('FACTURA: rechaza sin el permiso facturacion.ver, sin llamar a Twilio', async () => {
      await expect(
        service.enviarDocumento('t1', 'whatsapp:+18095551234', { clienteId: 'c1', tipo: 'FACTURA', documentoId: 'f1' }, []),
      ).rejects.toThrow(ForbiddenException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('FACTURA: rechaza si la factura pertenece a otro cliente (IDOR)', async () => {
      facturacionService.buscarPorId.mockResolvedValue({ id: 'f1', clienteId: 'otro-cliente', numero: 'F-001', ncf: null, total: 100 } as never);

      await expect(
        service.enviarDocumento('t1', 'whatsapp:+18095551234', { clienteId: 'c1', tipo: 'FACTURA', documentoId: 'f1' }, PERMISOS_COMPLETOS),
      ).rejects.toThrow(BadRequestException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('FACTURA: arma la mediaUrl del PDF público y la manda a Twilio', async () => {
      facturacionService.buscarPorId.mockResolvedValue({ id: 'f1', clienteId: 'c1', numero: 'F-001', ncf: null, total: 1000 } as never);

      await service.enviarDocumento('t1', 'whatsapp:+18095551234', { clienteId: 'c1', tipo: 'FACTURA', documentoId: 'f1' }, PERMISOS_COMPLETOS);

      const [, opciones] = fetchMock.mock.calls[0];
      const body = opciones.body as URLSearchParams;
      expect(body.get('MediaUrl')).toBe('https://app.ciguadev.com/api/documentos-publicos/facturas/f1/pdf');
    });

    it('COTIZACION: rechaza si la cotización pertenece a otro cliente (IDOR)', async () => {
      cotizacionesService.buscarPorId.mockResolvedValue({ id: 'q1', clienteId: 'otro-cliente', numero: 'COT-001', total: 100 } as never);

      await expect(
        service.enviarDocumento('t1', 'whatsapp:+18095551234', { clienteId: 'c1', tipo: 'COTIZACION', documentoId: 'q1' }, PERMISOS_COMPLETOS),
      ).rejects.toThrow(BadRequestException);
    });

    it('ESTADO_CUENTA: arma la mediaUrl del endpoint público de estado de cuenta', async () => {
      await service.enviarDocumento('t1', 'whatsapp:+18095551234', { clienteId: 'c1', tipo: 'ESTADO_CUENTA' }, PERMISOS_COMPLETOS);

      const [, opciones] = fetchMock.mock.calls[0];
      const body = opciones.body as URLSearchParams;
      expect(body.get('MediaUrl')).toBe('https://app.ciguadev.com/api/documentos-publicos/clientes/c1/estado-cuenta/pdf');
    });

    it('FACTURAS_PENDIENTES: solo incluye las no pagadas, cada una con su link', async () => {
      clientesService.estadoCuenta.mockResolvedValue({
        facturas: [
          { id: 'f1', numero: 'F-001', ncf: null, fecha: new Date('2026-01-01'), total: 100, pagada: true, saldoPendiente: 0 },
          { id: 'f2', numero: 'F-002', ncf: null, fecha: new Date('2026-01-02'), total: 200, pagada: false, saldoPendiente: 200 },
        ],
      } as never);

      await service.enviarDocumento('t1', 'whatsapp:+18095551234', { clienteId: 'c1', tipo: 'FACTURAS_PENDIENTES' }, PERMISOS_COMPLETOS);

      const [, opciones] = fetchMock.mock.calls[0];
      const body = opciones.body as URLSearchParams;
      expect(body.get('Body')).toContain('F-002');
      expect(body.get('Body')).not.toContain('F-001');
    });

    it('FACTURAS_RECIENTES: rechaza si el cliente no tiene ninguna factura', async () => {
      clientesService.estadoCuenta.mockResolvedValue({ facturas: [] } as never);

      await expect(
        service.enviarDocumento('t1', 'whatsapp:+18095551234', { clienteId: 'c1', tipo: 'FACTURAS_RECIENTES' }, PERMISOS_COMPLETOS),
      ).rejects.toThrow(BadRequestException);
    });

    it('COTIZACIONES_RECIENTES: lista cada cotización con su link público', async () => {
      cotizacionesService.listarRecientesPorCliente.mockResolvedValue([
        { id: 'q1', numero: 'COT-001', total: 500, estado: 'ENVIADA', createdAt: new Date('2026-01-01') },
      ] as never);

      await service.enviarDocumento('t1', 'whatsapp:+18095551234', { clienteId: 'c1', tipo: 'COTIZACIONES_RECIENTES' }, PERMISOS_COMPLETOS);

      const [, opciones] = fetchMock.mock.calls[0];
      const body = opciones.body as URLSearchParams;
      expect(body.get('Body')).toContain('COT-001');
      expect(body.get('Body')).toContain('https://app.ciguadev.com/api/documentos-publicos/cotizaciones/q1/pdf');
    });
  });

  describe('obtenerDocumentosCliente', () => {
    it('omite las secciones cuyo permiso falta, sin lanzar', async () => {
      const resultado = await service.obtenerDocumentosCliente('c1', []);

      expect(resultado).toEqual({ facturasRecientes: [], facturasPendientes: [], cotizacionesRecientes: [] });
      expect(clientesService.estadoCuenta).not.toHaveBeenCalled();
      expect(cotizacionesService.listarRecientesPorCliente).not.toHaveBeenCalled();
    });

    it('invierte las facturas (más reciente primero) y separa las pendientes', async () => {
      clientesService.estadoCuenta.mockResolvedValue({
        facturas: [
          { id: 'f1', numero: 'F-001', fecha: new Date('2026-01-01'), pagada: true },
          { id: 'f2', numero: 'F-002', fecha: new Date('2026-01-02'), pagada: false },
        ],
      } as never);
      cotizacionesService.listarRecientesPorCliente.mockResolvedValue([{ id: 'q1', numero: 'COT-001' }] as never);

      const resultado = await service.obtenerDocumentosCliente('c1', ['clientes.ver', 'cotizaciones.ver']);

      expect(resultado.facturasRecientes.map((f) => f.id)).toEqual(['f2', 'f1']);
      expect(resultado.facturasPendientes.map((f) => f.id)).toEqual(['f2']);
      expect(resultado.cotizacionesRecientes).toEqual([{ id: 'q1', numero: 'COT-001' }]);
    });
  });

  describe('listarConversaciones', () => {
    it('delega en el repositorio (inbox completo de la página "Mensajes")', async () => {
      await service.listarConversaciones();
      expect(whatsappMensajesRepository.listarConversaciones).toHaveBeenCalled();
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
