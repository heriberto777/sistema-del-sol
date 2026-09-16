process.env.ENCRYPTION_KEY = 'clave-de-prueba';
process.env.WHATSAPP_WEBHOOK_URL = 'https://app.ciguadev.com/api/webhooks/whatsapp/inbound';

import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappMensajesRepository } from './whatsapp-mensajes.repository';
import { ConversacionIaService } from '../ia/conversacion/conversacion-ia.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { cifrar } from '../common/utils/encriptado.util';

const CONFIG_BASE = {
  id: 'w1',
  tenantId: 't1',
  twilioAccountSid: 'ACxxx',
  twilioAuthTokenCifrado: cifrar('twilio-auth-token'),
  twilioWhatsappFrom: '+14155238886',
  iaProveedor: 'ANTHROPIC',
  iaModelo: null,
  iaApiKeyCifrado: cifrar('sk-ant-tenant'),
  iaPromptNegocio: 'Horario: L-V 9am-5pm.',
  historialMensajes: 10,
  limiteRespuestasDiarias: 50,
};

const MENSAJE_ENTRANTE = { id: 'm1', tenantId: 't1', telefono: 'whatsapp:+18095551234', rol: 'USUARIO', contenido: 'hola', diaRD: '2026-08-25' };

describe('WhatsappBotService', () => {
  let service: WhatsappBotService;
  let prisma: {
    whatsappConfigTenant: { findUnique: jest.Mock };
    whatsappMensaje: { update: jest.Mock };
    producto: { findMany: jest.Mock };
    categoria: { findMany: jest.Mock };
    user: { findFirst: jest.Mock };
    tareaPersonal: { findMany: jest.Mock };
  };
  let whatsappMensajesRepository: jest.Mocked<WhatsappMensajesRepository>;
  let conversacionIaService: jest.Mocked<ConversacionIaService>;
  let eventBus: jest.Mocked<EventBusService>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    prisma = {
      whatsappConfigTenant: { findUnique: jest.fn() },
      whatsappMensaje: { update: jest.fn() },
      producto: { findMany: jest.fn().mockResolvedValue([]) },
      categoria: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      tareaPersonal: { findMany: jest.fn().mockResolvedValue([]) },
    };
    whatsappMensajesRepository = {
      crear: jest.fn().mockResolvedValue(MENSAJE_ENTRANTE),
      contarRespuestasHoy: jest.fn().mockResolvedValue(0),
      historialReciente: jest.fn().mockResolvedValue([MENSAJE_ENTRANTE]),
    } as unknown as jest.Mocked<WhatsappMensajesRepository>;
    conversacionIaService = {
      completar: jest.fn().mockResolvedValue('{"respuesta":"Hola, en qué te ayudo?","requiereHumano":false}'),
    } as unknown as jest.Mocked<ConversacionIaService>;
    eventBus = { emit: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    service = new WhatsappBotService(prisma as never, whatsappMensajesRepository, conversacionIaService, eventBus);
  });

  describe('procesarMensajeEntrante', () => {
    it('responde con IA y no emite el evento cuando requiereHumano es false', async () => {
      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(conversacionIaService.completar).toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalled(); // enviarWhatsappTwilio
    });

    it('pasa el proveedor elegido por el tenant al servicio de IA', async () => {
      await service.procesarMensajeEntrante({ ...CONFIG_BASE, iaProveedor: 'GEMINI' }, 'whatsapp:+18095551234', 'hola');

      expect(conversacionIaService.completar).toHaveBeenCalledWith('GEMINI', expect.any(Array), expect.any(Object));
    });

    it('usa la apiKey descifrada del tenant, no una de plataforma', async () => {
      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(conversacionIaService.completar).toHaveBeenCalledWith('ANTHROPIC', expect.any(Array), expect.objectContaining({ apiKey: 'sk-ant-tenant' }));
    });

    it('incluye el iaPromptNegocio del tenant en el system prompt', async () => {
      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      const [, , opciones] = conversacionIaService.completar.mock.calls[0];
      expect(opciones?.system).toContain('Horario: L-V 9am-5pm.');
    });

    it('guarda el perfilNombre (Username/ProfileName de Twilio) en el mensaje USUARIO', async () => {
      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola', 'Rosa Martínez');

      const llamadaUsuario = whatsappMensajesRepository.crear.mock.calls.find((c) => c[0].rol === 'USUARIO');
      expect(llamadaUsuario?.[0]).toMatchObject({ perfilNombre: 'Rosa Martínez' });
    });

    it('sin perfilNombre: guarda null, no rompe nada', async () => {
      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      const llamadaUsuario = whatsappMensajesRepository.crear.mock.calls.find((c) => c[0].rol === 'USUARIO');
      expect(llamadaUsuario?.[0]).toMatchObject({ perfilNombre: null });
    });

    it('tope diario alcanzado: no llama a la IA, marca requiereHumano y emite el evento', async () => {
      whatsappMensajesRepository.contarRespuestasHoy.mockResolvedValue(50);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(conversacionIaService.completar).not.toHaveBeenCalled();
      expect(prisma.whatsappMensaje.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { requiereAtencionHumana: true } });
      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.WHATSAPP_REQUIERE_ATENCION, expect.objectContaining({ tenantId: 't1' }));
    });

    it('sin iaApiKeyCifrado configurada: no llama a la IA y escala a humano', async () => {
      await service.procesarMensajeEntrante({ ...CONFIG_BASE, iaApiKeyCifrado: null }, 'whatsapp:+18095551234', 'hola');

      expect(conversacionIaService.completar).not.toHaveBeenCalled();
      expect(eventBus.emit).toHaveBeenCalled();
    });

    it('JSON inválido de la IA: fail-safe a requiereHumano con una respuesta genérica', async () => {
      conversacionIaService.completar.mockResolvedValue('esto no es JSON');

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(eventBus.emit).toHaveBeenCalled();
      const llamadaCrear = whatsappMensajesRepository.crear.mock.calls.find((c) => c[0].rol === 'ASISTENTE');
      expect(llamadaCrear?.[0].contenido).toMatch(/conectarte con alguien del equipo/i);
    });

    it('la IA sin respuesta (null): fail-safe a requiereHumano', async () => {
      conversacionIaService.completar.mockResolvedValue(null);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(eventBus.emit).toHaveBeenCalled();
    });

    it('respeta requiereHumano:true devuelto por la IA aunque haya respondido bien', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"Dejame conectarte con soporte","requiereHumano":true}');

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.WHATSAPP_REQUIERE_ATENCION, expect.objectContaining({ telefono: 'whatsapp:+18095551234' }));
    });

    it('pasa el historial reciente (sin el mensaje entrante duplicado) como mensajes a la IA', async () => {
      whatsappMensajesRepository.historialReciente.mockResolvedValue([
        { ...MENSAJE_ENTRANTE, id: 'm0', rol: 'ASISTENTE', contenido: 'Hola, bienvenido' } as never,
        MENSAJE_ENTRANTE as never,
      ]);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      const [, mensajes] = conversacionIaService.completar.mock.calls[0];
      expect(mensajes).toEqual([
        { role: 'assistant', content: 'Hola, bienvenido' },
        { role: 'user', content: 'hola' },
      ]);
    });
  });

  describe('procesarMensajeEntrante — buscarProducto', () => {
    const PRODUCTO_CON_PRECIO = {
      id: 'p1',
      nombre: 'Yogurt Fresa',
      imagen: 'data:image/png;base64,abc',
      variantes: [{ precios: [{ precioVenta: '59.00' }] }],
    };

    it('exactamente 1 coincidencia con imagen: manda un segundo mensaje con mediaUrl', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"Sí, mirá","requiereHumano":false,"buscarProducto":"yogurt"}');
      prisma.producto.findMany.mockResolvedValue([PRODUCTO_CON_PRECIO]);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'tienen yogurt?');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [, opciones] = fetchMock.mock.calls[1];
      const body = opciones.body as URLSearchParams;
      expect(body.get('MediaUrl')).toBe('https://app.ciguadev.com/api/public/productos/p1/imagen');
      expect(body.get('Body')).toBe('Yogurt Fresa — RD$ 59.00');
    });

    it('con categoría y descripción de tienda: el caption las incluye', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"Sí, mirá","requiereHumano":false,"buscarProducto":"yogurt"}');
      prisma.producto.findMany.mockResolvedValue([
        { ...PRODUCTO_CON_PRECIO, categoria: { nombre: 'Lácteos' }, descripcionTienda: 'Yogurt natural sabor fresa.' },
      ]);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'tienen yogurt?');

      const [, opciones] = fetchMock.mock.calls[1];
      const body = opciones.body as URLSearchParams;
      expect(body.get('Body')).toBe('Yogurt Fresa — RD$ 59.00\nCategoría: Lácteos\nYogurt natural sabor fresa.');
    });

    it('0 coincidencias: no manda un segundo mensaje', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"No tengo eso","requiereHumano":false,"buscarProducto":"algo raro"}');
      prisma.producto.findMany.mockResolvedValue([]);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'tienen algo raro?');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('2+ coincidencias: no adivina, no manda nada extra', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"Tenemos varias opciones","requiereHumano":false,"buscarProducto":"camisa"}');
      prisma.producto.findMany.mockResolvedValue([PRODUCTO_CON_PRECIO, { ...PRODUCTO_CON_PRECIO, id: 'p2' }]);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'tienen camisas?');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('única coincidencia pero sin imagen cargada: no manda nada extra', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"Sí tenemos","requiereHumano":false,"buscarProducto":"yogurt"}');
      prisma.producto.findMany.mockResolvedValue([{ ...PRODUCTO_CON_PRECIO, imagen: null }]);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'tienen yogurt?');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('buscarProducto null: nunca busca en el catálogo', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"Hola!","requiereHumano":false,"buscarProducto":null}');

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(prisma.producto.findMany).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('procesarMensajeEntrante — buscarCategoria', () => {
    const PRODUCTOS_LACTEOS = [
      { id: 'p1', nombre: 'Yogurt Fresa', imagen: 'data:image/png;base64,abc', categoria: { nombre: 'Lácteos' }, descripcionTienda: null, variantes: [{ precios: [{ precioVenta: '59.00' }] }] },
      { id: 'p2', nombre: 'Yogurt Vainilla', imagen: 'data:image/png;base64,def', categoria: { nombre: 'Lácteos' }, descripcionTienda: null, variantes: [{ precios: [{ precioVenta: '55.00' }] }] },
    ];

    it('exactamente 1 categoría: manda una foto por cada producto de esa categoría, en secuencia', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"Mirá lo que tenemos","requiereHumano":false,"buscarCategoria":"lacteos"}');
      prisma.categoria.findMany.mockResolvedValue([{ id: 'cat1' }]);
      prisma.producto.findMany.mockResolvedValue(PRODUCTOS_LACTEOS);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'qué tienen de lácteos?');

      expect(prisma.categoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1', activa: true }) }),
      );
      // 1 respuesta de texto + 2 fotos (una por producto) = 3 llamadas a fetch, en orden.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const body1 = (fetchMock.mock.calls[1][1].body as URLSearchParams);
      const body2 = (fetchMock.mock.calls[2][1].body as URLSearchParams);
      expect(body1.get('MediaUrl')).toBe('https://app.ciguadev.com/api/public/productos/p1/imagen');
      expect(body2.get('MediaUrl')).toBe('https://app.ciguadev.com/api/public/productos/p2/imagen');
    });

    it('0 categorías coincidentes: no manda nada extra', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"No tengo esa categoría","requiereHumano":false,"buscarCategoria":"electrodomésticos"}');
      prisma.categoria.findMany.mockResolvedValue([]);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'qué tienen de electrodomésticos?');

      expect(prisma.producto.findMany).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('2+ categorías coincidentes: no adivina, no manda nada extra', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"Tenemos varias secciones","requiereHumano":false,"buscarCategoria":"ropa"}');
      prisma.categoria.findMany.mockResolvedValue([{ id: 'cat1' }, { id: 'cat2' }]);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'qué tienen de ropa?');

      expect(prisma.producto.findMany).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('categoría encontrada pero sin productos con foto: no manda nada extra', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"Tenemos, pero sin fotos cargadas","requiereHumano":false,"buscarCategoria":"lacteos"}');
      prisma.categoria.findMany.mockResolvedValue([{ id: 'cat1' }]);
      prisma.producto.findMany.mockResolvedValue([]);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'qué tienen de lácteos?');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('si un envío del lote falla, sigue mandando los demás en vez de abortar', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"Mirá lo que tenemos","requiereHumano":false,"buscarCategoria":"lacteos"}');
      prisma.categoria.findMany.mockResolvedValue([{ id: 'cat1' }]);
      prisma.producto.findMany.mockResolvedValue(PRODUCTOS_LACTEOS);
      fetchMock
        .mockResolvedValueOnce({ ok: true }) // respuesta de texto
        .mockResolvedValueOnce({ ok: false }) // falla la foto del producto 1
        .mockResolvedValueOnce({ ok: true }); // la foto del producto 2 igual se manda

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'qué tienen de lácteos?');

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('buscarProducto y buscarCategoria juntos: prioriza buscarProducto, ignora buscarCategoria', async () => {
      conversacionIaService.completar.mockResolvedValue(
        '{"respuesta":"Mirá","requiereHumano":false,"buscarProducto":"yogurt","buscarCategoria":"lacteos"}',
      );
      prisma.producto.findMany.mockResolvedValue([]);

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'tienen yogurt de lácteos?');

      expect(prisma.categoria.findMany).not.toHaveBeenCalled();
    });

    it('buscarCategoria null: nunca busca categorías', async () => {
      conversacionIaService.completar.mockResolvedValue('{"respuesta":"Hola!","requiereHumano":false,"buscarCategoria":null}');

      await service.procesarMensajeEntrante(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(prisma.categoria.findMany).not.toHaveBeenCalled();
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

  describe('intentarResponderComoEmpleado', () => {
    it('devuelve false sin ningún efecto secundario si el número no es de un empleado (sigue el flujo de cliente)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const manejado = await service.intentarResponderComoEmpleado(CONFIG_BASE, 'whatsapp:+18095551234', 'qué tengo hoy');

      expect(manejado).toBe(false);
      expect(prisma.tareaPersonal.findMany).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('filtra al empleado por tenantId + teléfono + activo', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await service.intentarResponderComoEmpleado(CONFIG_BASE, 'whatsapp:+18095551234', 'hola');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 't1', telefono: '+18095551234', activo: true },
        select: { id: true, nombre: true },
      });
    });

    it('empleado reconocido: clasifica con la IA propia del bot y responde con sus tareas reales (nunca inventadas)', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', nombre: 'Cristopher Reyes' });
      conversacionIaService.completar.mockResolvedValue('PENDIENTES');
      prisma.tareaPersonal.findMany.mockResolvedValue([
        { titulo: 'Sacar nota de crédito', prioridad: 'ALTA', fecha: null },
        { titulo: 'Reunión con Asistente Comercial', prioridad: 'MEDIA', fecha: null },
      ]);

      const manejado = await service.intentarResponderComoEmpleado(CONFIG_BASE, 'whatsapp:+18095551234', '¿cuáles son mis pendientes?');

      expect(manejado).toBe(true);
      expect(prisma.tareaPersonal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1', usuarioId: 'u1', estado: { not: 'HECHA' } }) }),
      );
      const cuerpoEnviado = fetchMock.mock.calls[0][1].body as URLSearchParams;
      expect(cuerpoEnviado.get('Body')).toContain('Sacar nota de crédito');
      expect(cuerpoEnviado.get('Body')).toContain('Reunión con Asistente Comercial');
    });

    it('sin tareas para "hoy", responde que no tiene ninguna en vez de una lista vacía', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', nombre: 'Cristopher Reyes' });
      conversacionIaService.completar.mockResolvedValue('HOY');
      prisma.tareaPersonal.findMany.mockResolvedValue([]);

      await service.intentarResponderComoEmpleado(CONFIG_BASE, 'whatsapp:+18095551234', 'qué tengo hoy');

      const cuerpoEnviado = fetchMock.mock.calls[0][1].body as URLSearchParams;
      expect(cuerpoEnviado.get('Body')).toContain('No tenés tareas para hoy, Cristopher');
    });

    it('intención DESCONOCIDA responde con el mensaje de ayuda, sin consultar la base de tareas', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', nombre: 'Cristopher Reyes' });
      conversacionIaService.completar.mockResolvedValue('DESCONOCIDA');

      await service.intentarResponderComoEmpleado(CONFIG_BASE, 'whatsapp:+18095551234', 'buenas tardes');

      expect(prisma.tareaPersonal.findMany).not.toHaveBeenCalled();
      const cuerpoEnviado = fetchMock.mock.calls[0][1].body as URLSearchParams;
      expect(cuerpoEnviado.get('Body')).toContain('Puedo contarte tus tareas');
    });

    it('sin IA configurada, clasifica por palabra clave en vez de fallar', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', nombre: 'Cristopher Reyes' });
      prisma.tareaPersonal.findMany.mockResolvedValue([{ titulo: 'Backup mensual', prioridad: 'ALTA', fecha: null }]);

      await service.intentarResponderComoEmpleado({ ...CONFIG_BASE, iaApiKeyCifrado: null }, 'whatsapp:+18095551234', 'tengo alguna tarea pendiente?');

      expect(conversacionIaService.completar).not.toHaveBeenCalled();
      const cuerpoEnviado = fetchMock.mock.calls[0][1].body as URLSearchParams;
      expect(cuerpoEnviado.get('Body')).toContain('Backup mensual');
    });

    it('no toca WhatsappMensajesRepository — no cuenta contra el límite diario de respuestas a clientes', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', nombre: 'Cristopher Reyes' });
      conversacionIaService.completar.mockResolvedValue('PENDIENTES');

      await service.intentarResponderComoEmpleado(CONFIG_BASE, 'whatsapp:+18095551234', 'pendientes');

      expect(whatsappMensajesRepository.crear).not.toHaveBeenCalled();
      expect(whatsappMensajesRepository.contarRespuestasHoy).not.toHaveBeenCalled();
    });
  });
});
