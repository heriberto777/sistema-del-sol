import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PublicacionesSocialesService } from './publicaciones-sociales.service';
import { PublicacionesSocialesRepository } from './publicaciones-sociales.repository';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappConfigRepository } from '../whatsapp-config/whatsapp-config.repository';
import { GeneradorFondoService } from '../ia/generador-fondo/generador-fondo.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { generarImagenPublicacionSocial } from './generador-imagen-publicacion-social';
import * as twilioWhatsappUtil from '../common/utils/twilio-whatsapp.util';

jest.mock('../common/impresion/resolver-personalizacion-documento');
jest.mock('./generador-imagen-publicacion-social');

const PRODUCTO_CON_PRECIO = {
  id: 'prod1',
  nombre: 'Yogurt Fresa',
  imagen: 'data:image/jpeg;base64,AAAA',
  categoriaId: null,
  variantes: [{ precios: [{ precioVenta: 100 }] }],
};
const PLANTILLA_ACTIVA = { id: 'pl1', clave: 'minimalista', nombre: 'Minimalista', activa: true };

describe('PublicacionesSocialesService', () => {
  let service: PublicacionesSocialesService;
  let repo: jest.Mocked<PublicacionesSocialesRepository>;
  let whatsappConfigRepository: jest.Mocked<WhatsappConfigRepository>;
  let generadorFondoService: jest.Mocked<GeneradorFondoService>;
  let ofertasService: jest.Mocked<OfertasService>;
  let eventBus: jest.Mocked<EventBusService>;
  let prisma: {
    user: { findFirst: jest.Mock };
    publicacionSocial: { findMany: jest.Mock; update: jest.Mock };
    whatsappConfigTenant: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    repo = {
      crear: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      actualizarEstado: jest.fn(),
      actualizarComentarioVersion: jest.fn(),
      regenerar: jest.fn(),
      buscarProductoParaGenerar: jest.fn(),
      buscarPlantillaPorId: jest.fn(),
      listarPlantillasActivas: jest.fn(),
      contarGeneracionesIaDelMes: jest.fn(),
      buscarLimiteIaFondo: jest.fn(),
    } as unknown as jest.Mocked<PublicacionesSocialesRepository>;
    whatsappConfigRepository = { obtenerOCrear: jest.fn(), actualizar: jest.fn() } as unknown as jest.Mocked<WhatsappConfigRepository>;
    generadorFondoService = { generarDesdeDataUri: jest.fn(), listarModelos: jest.fn() } as unknown as jest.Mocked<GeneradorFondoService>;
    ofertasService = { resolverOfertaVisibleProducto: jest.fn() } as unknown as jest.Mocked<OfertasService>;
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    prisma = {
      user: { findFirst: jest.fn() },
      publicacionSocial: { findMany: jest.fn(), update: jest.fn() },
      whatsappConfigTenant: { findUnique: jest.fn() },
    };
    service = new PublicacionesSocialesService(repo, prisma as unknown as PrismaService, whatsappConfigRepository, generadorFondoService, ofertasService, eventBus);

    jest.mocked(resolverPersonalizacionDocumento).mockResolvedValue({ logo: undefined, notaPie: undefined });
    jest.mocked(generarImagenPublicacionSocial).mockResolvedValue('data:image/png;base64,BANNER');
    repo.buscarProductoParaGenerar.mockResolvedValue(PRODUCTO_CON_PRECIO as never);
    repo.buscarPlantillaPorId.mockResolvedValue(PLANTILLA_ACTIVA as never);
    repo.crear.mockResolvedValue({ id: 'nueva' } as never);
    ofertasService.resolverOfertaVisibleProducto.mockResolvedValue(null);
  });

  describe('crear', () => {
    it('sin promptIa: no llama a la IA, dibuja con Canvas, guarda origen FOTO_PRODUCTO', async () => {
      await service.crear({ productoId: 'prod1', plantillaId: 'pl1' }, 't1', 'u1');

      expect(generadorFondoService.generarDesdeDataUri).not.toHaveBeenCalled();
      expect(generarImagenPublicacionSocial).toHaveBeenCalled();
      expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ origen: 'FOTO_PRODUCTO', promptIa: null, formato: 'CUADRADO' }));
    });

    it('con promptIa: arma un prompt con el precio real y NO dibuja con Canvas (evita el bug de dos precios)', async () => {
      repo.contarGeneracionesIaDelMes.mockResolvedValue(2);
      repo.buscarLimiteIaFondo.mockResolvedValue(20);
      generadorFondoService.generarDesdeDataUri.mockResolvedValue('data:image/png;base64,FONDO_IA');

      await service.crear({ productoId: 'prod1', plantillaId: 'pl1', promptIa: 'fondo de cocina moderna' }, 't1', 'u1');

      expect(ofertasService.resolverOfertaVisibleProducto).toHaveBeenCalledWith('prod1', null, 100);
      const [imagenPasada, promptArmado, formatoPasado] = generadorFondoService.generarDesdeDataUri.mock.calls[0];
      expect(imagenPasada).toBe(PRODUCTO_CON_PRECIO.imagen);
      expect(promptArmado).toEqual(expect.stringContaining('RD$ 100.00'));
      expect(promptArmado).toEqual(expect.stringContaining('fondo de cocina moderna'));
      expect(formatoPasado).toBe('CUADRADO');
      expect(generarImagenPublicacionSocial).not.toHaveBeenCalled();
      expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ origen: 'IA', promptIa: 'fondo de cocina moderna', formato: 'CUADRADO' }));
    });

    it('Fase 4 — rechaza el formato VERTICAL sin promptIa', async () => {
      await expect(
        service.crear({ productoId: 'prod1', plantillaId: 'pl1', formato: 'VERTICAL' }, 't1', 'u1'),
      ).rejects.toThrow(BadRequestException);
      expect(generadorFondoService.generarDesdeDataUri).not.toHaveBeenCalled();
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('Fase 4 — acepta VERTICAL junto con promptIa y lo reenvía/guarda', async () => {
      repo.contarGeneracionesIaDelMes.mockResolvedValue(0);
      repo.buscarLimiteIaFondo.mockResolvedValue(20);
      generadorFondoService.generarDesdeDataUri.mockResolvedValue('data:image/png;base64,FONDO_IA');

      await service.crear({ productoId: 'prod1', plantillaId: 'pl1', promptIa: 'fondo playero', formato: 'VERTICAL' }, 't1', 'u1');

      const [, , formatoPasado] = generadorFondoService.generarDesdeDataUri.mock.calls[0];
      expect(formatoPasado).toBe('VERTICAL');
      expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ formato: 'VERTICAL' }));
    });

    it('con oferta activa: el prompt incluye el precio con descuento real', async () => {
      repo.contarGeneracionesIaDelMes.mockResolvedValue(0);
      repo.buscarLimiteIaFondo.mockResolvedValue(20);
      ofertasService.resolverOfertaVisibleProducto.mockResolvedValue({ tipo: 'DESCUENTO', precioConDescuento: 80, ahorro: 20, porcentaje: 20 });
      generadorFondoService.generarDesdeDataUri.mockResolvedValue('data:image/png;base64,FONDO_IA');

      await service.crear({ productoId: 'prod1', plantillaId: 'pl1', promptIa: 'estilo elegante' }, 't1', 'u1');

      const [, promptArmado] = generadorFondoService.generarDesdeDataUri.mock.calls[0];
      expect(promptArmado).toEqual(expect.stringContaining('RD$ 80.00'));
      expect(promptArmado).toEqual(expect.stringContaining('20% OFF'));
    });

    it('rechaza si ya alcanzó el límite mensual de generaciones con IA', async () => {
      repo.contarGeneracionesIaDelMes.mockResolvedValue(20);
      repo.buscarLimiteIaFondo.mockResolvedValue(20);

      await expect(
        service.crear({ productoId: 'prod1', plantillaId: 'pl1', promptIa: 'otro fondo' }, 't1', 'u1'),
      ).rejects.toThrow(BadRequestException);
      expect(generadorFondoService.generarDesdeDataUri).not.toHaveBeenCalled();
      expect(repo.crear).not.toHaveBeenCalled();
    });
  });

  describe('consultarUsoIaMensual', () => {
    it('devuelve usados y límite del tenant, sin registrar nada nuevo', async () => {
      repo.contarGeneracionesIaDelMes.mockResolvedValue(3);
      repo.buscarLimiteIaFondo.mockResolvedValue(20);

      const resultado = await service.consultarUsoIaMensual('t1');

      expect(resultado).toEqual({ usados: 3, limite: 20 });
      expect(repo.contarGeneracionesIaDelMes).toHaveBeenCalledWith('t1');
    });
  });

  describe('buscarPorId', () => {
    it('enriquece con precio formateado y sin oferta', async () => {
      repo.buscarPorId.mockResolvedValue({
        id: 'p1',
        producto: { id: 'prod1', categoriaId: null, variantes: [{ precios: [{ precioVenta: 100 }] }] },
      } as never);
      ofertasService.resolverOfertaVisibleProducto.mockResolvedValue(null);

      const resultado = await service.buscarPorId('p1');

      expect(resultado.producto.precioFormateado).toBe('RD$ 100.00');
      expect(resultado.producto.oferta).toBeNull();
    });

    it('enriquece con precio con descuento cuando hay oferta activa', async () => {
      repo.buscarPorId.mockResolvedValue({
        id: 'p1',
        producto: { id: 'prod1', categoriaId: null, variantes: [{ precios: [{ precioVenta: 100 }] }] },
      } as never);
      ofertasService.resolverOfertaVisibleProducto.mockResolvedValue({ tipo: 'DESCUENTO', precioConDescuento: 80, ahorro: 20, porcentaje: 20 });

      const resultado = await service.buscarPorId('p1');

      expect(resultado.producto.precioConDescuentoFormateado).toBe('RD$ 80.00');
    });
  });

  describe('enviarAAprobacion', () => {
    it('pasa de BORRADOR a PENDIENTE_APROBACION y avisa a los aprobadores', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'BORRADOR', producto: { nombre: 'Yogurt Fresa' } } as never);
      repo.actualizarEstado.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await service.enviarAAprobacion('p1', 't1');

      expect(repo.actualizarEstado).toHaveBeenCalledWith('p1', { estado: 'PENDIENTE_APROBACION' });
      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.PUBLICACION_SOCIAL_PENDIENTE_APROBACION, {
        tenantId: 't1',
        publicacionId: 'p1',
        productoNombre: 'Yogurt Fresa',
      });
    });

    it('rechaza si la publicación no está en BORRADOR', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.enviarAAprobacion('p1', 't1')).rejects.toThrow(BadRequestException);
      expect(repo.actualizarEstado).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('cambiarEstado', () => {
    it('aprueba una publicación PENDIENTE_APROBACION y avisa al creador', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION', creadoPorId: 'creador1', producto: { nombre: 'Yogurt Fresa' } } as never);
      repo.actualizarEstado.mockResolvedValue({ id: 'p1', estado: 'APROBADA' } as never);

      await service.cambiarEstado('p1', 'APROBADA', 'u1', 't1');

      expect(repo.actualizarEstado).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ estado: 'APROBADA', aprobadoPorId: 'u1' }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.PUBLICACION_SOCIAL_APROBADA, {
        tenantId: 't1',
        publicacionId: 'p1',
        productoNombre: 'Yogurt Fresa',
        creadoPorId: 'creador1',
      });
    });

    it('rechaza con motivo obligatorio', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.cambiarEstado('p1', 'RECHAZADA', 'u1', 't1')).rejects.toThrow(BadRequestException);
      expect(repo.actualizarEstado).not.toHaveBeenCalled();
    });

    it('rechaza con motivo en blanco igual que sin motivo', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.cambiarEstado('p1', 'RECHAZADA', 'u1', 't1', '   ')).rejects.toThrow(BadRequestException);
    });

    it('acepta un rechazo con motivo real y avisa al creador', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION', creadoPorId: 'creador1', producto: { nombre: 'Yogurt Fresa' } } as never);
      repo.actualizarEstado.mockResolvedValue({ id: 'p1', estado: 'RECHAZADA' } as never);

      await service.cambiarEstado('p1', 'RECHAZADA', 'u1', 't1', 'La foto sale borrosa');

      expect(repo.actualizarEstado).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ estado: 'RECHAZADA', motivoRechazo: 'La foto sale borrosa' }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.PUBLICACION_SOCIAL_RECHAZADA, {
        tenantId: 't1',
        publicacionId: 'p1',
        productoNombre: 'Yogurt Fresa',
        creadoPorId: 'creador1',
        motivoRechazo: 'La foto sale borrosa',
      });
    });

    it('no permite aprobar/rechazar una publicación que no está PENDIENTE_APROBACION', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'BORRADOR' } as never);

      await expect(service.cambiarEstado('p1', 'APROBADA', 'u1', 't1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('solicitarCambios', () => {
    it('guarda el comentario en la versión vigente y pasa a CAMBIOS_SOLICITADOS', async () => {
      repo.buscarPorId.mockResolvedValue({
        id: 'p1',
        estado: 'PENDIENTE_APROBACION',
        creadoPorId: 'creador1',
        producto: { nombre: 'Yogurt Fresa' },
        versiones: [{ id: 'v1', numero: 1 }],
      } as never);
      repo.actualizarEstado.mockResolvedValue({ id: 'p1', estado: 'CAMBIOS_SOLICITADOS' } as never);

      await service.solicitarCambios('p1', 't1', 'aprobador1', 'cambiale el color a azul');

      expect(repo.actualizarComentarioVersion).toHaveBeenCalledWith('v1', 'cambiale el color a azul');
      expect(repo.actualizarEstado).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ estado: 'CAMBIOS_SOLICITADOS', aprobadoPorId: 'aprobador1' }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.PUBLICACION_SOCIAL_CAMBIOS_SOLICITADOS, {
        tenantId: 't1',
        publicacionId: 'p1',
        productoNombre: 'Yogurt Fresa',
        creadoPorId: 'creador1',
        comentario: 'cambiale el color a azul',
      });
    });

    it('solo se puede pedir cambios desde PENDIENTE_APROBACION', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'BORRADOR' } as never);

      await expect(service.solicitarCambios('p1', 't1', 'aprobador1', 'algo')).rejects.toThrow(BadRequestException);
      expect(repo.actualizarComentarioVersion).not.toHaveBeenCalled();
    });
  });

  describe('regenerar', () => {
    const PUBLICACION_CON_CAMBIOS_SOLICITADOS = {
      id: 'p1',
      estado: 'CAMBIOS_SOLICITADOS',
      productoId: 'prod1',
      plantillaId: 'pl1',
      promptIa: null,
      formato: 'CUADRADO',
      versiones: [{ id: 'v1', numero: 1 }],
    };

    it('solo se puede regenerar desde CAMBIOS_SOLICITADOS', async () => {
      repo.buscarPorId.mockResolvedValue({ ...PUBLICACION_CON_CAMBIOS_SOLICITADOS, estado: 'BORRADOR' } as never);

      await expect(service.regenerar('p1', 't1', 'creador1', {})).rejects.toThrow(BadRequestException);
      expect(repo.regenerar).not.toHaveBeenCalled();
    });

    it('regenera con Canvas (sin promptIa) y agrega la versión 2', async () => {
      repo.buscarPorId.mockResolvedValue(PUBLICACION_CON_CAMBIOS_SOLICITADOS as never);
      repo.regenerar.mockResolvedValue({ id: 'p1', estado: 'BORRADOR' } as never);

      await service.regenerar('p1', 't1', 'creador1', {});

      expect(repo.regenerar).toHaveBeenCalledWith('p1', expect.objectContaining({ numero: 2, origen: 'FOTO_PRODUCTO', creadoPorId: 'creador1' }));
    });

    it('regenera con IA cuando se manda un promptIa nuevo', async () => {
      repo.buscarPorId.mockResolvedValue(PUBLICACION_CON_CAMBIOS_SOLICITADOS as never);
      repo.contarGeneracionesIaDelMes.mockResolvedValue(0);
      repo.buscarLimiteIaFondo.mockResolvedValue(20);
      generadorFondoService.generarDesdeDataUri.mockResolvedValue('data:image/png;base64,FONDO_IA');
      repo.regenerar.mockResolvedValue({ id: 'p1', estado: 'BORRADOR' } as never);

      await service.regenerar('p1', 't1', 'creador1', { promptIa: 'ahora con fondo azul' });

      expect(repo.regenerar).toHaveBeenCalledWith('p1', expect.objectContaining({ numero: 2, origen: 'IA', promptIa: 'ahora con fondo azul' }));
    });

    it('rechaza VERTICAL sin promptIa (ni el nuevo ni el que ya tenía)', async () => {
      repo.buscarPorId.mockResolvedValue(PUBLICACION_CON_CAMBIOS_SOLICITADOS as never);

      await expect(service.regenerar('p1', 't1', 'creador1', { formato: 'VERTICAL' })).rejects.toThrow(BadRequestException);
      expect(repo.regenerar).not.toHaveBeenCalled();
    });
  });

  describe('enviarPorWhatsapp', () => {
    it('rechaza si la publicación no está APROBADA', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.enviarPorWhatsapp('p1', '+18095551234', 't1')).rejects.toThrow(BadRequestException);
      expect(whatsappConfigRepository.obtenerOCrear).not.toHaveBeenCalled();
    });

    it('degrada con un error claro si el tenant no configuró Twilio', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'APROBADA', producto: { nombre: 'Yogurt Fresa' } } as never);
      whatsappConfigRepository.obtenerOCrear.mockResolvedValue({} as never);

      await expect(service.enviarPorWhatsapp('p1', '+18095551234', 't1')).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('intentarAprobarPorWhatsapp (Fase 5 — botón "Aprobar" del webhook entrante)', () => {
    beforeEach(() => {
      prisma.whatsappConfigTenant.findUnique.mockResolvedValue({} as never);
    });

    it('devuelve false (sigue el bot normal) si el teléfono no es de un aprobador conocido', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const manejado = await service.intentarAprobarPorWhatsapp('t1', '+18095550000');

      expect(manejado).toBe(false);
      expect(prisma.publicacionSocial.findMany).not.toHaveBeenCalled();
    });

    it('aprueba directo cuando hay exactamente una pendiente y avisa al creador', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'aprobador1' });
      prisma.publicacionSocial.findMany.mockResolvedValue([
        { id: 'p1', creadoPorId: 'creador1', producto: { nombre: 'Yogurt Fresa' } },
      ]);

      const manejado = await service.intentarAprobarPorWhatsapp('t1', '+18095551234');

      expect(manejado).toBe(true);
      expect(prisma.publicacionSocial.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: expect.objectContaining({ estado: 'APROBADA', aprobadoPorId: 'aprobador1' }),
      });
      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.PUBLICACION_SOCIAL_APROBADA, {
        tenantId: 't1',
        publicacionId: 'p1',
        productoNombre: 'Yogurt Fresa',
        creadoPorId: 'creador1',
      });
    });

    it('no adivina cuál aprobar si hay más de una pendiente', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'aprobador1' });
      prisma.publicacionSocial.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

      const manejado = await service.intentarAprobarPorWhatsapp('t1', '+18095551234');

      expect(manejado).toBe(true);
      expect(prisma.publicacionSocial.update).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('contesta "nada pendiente" sin romper si no hay ninguna PENDIENTE_APROBACION', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'aprobador1' });
      prisma.publicacionSocial.findMany.mockResolvedValue([]);

      const manejado = await service.intentarAprobarPorWhatsapp('t1', '+18095551234');

      expect(manejado).toBe(true);
      expect(prisma.publicacionSocial.update).not.toHaveBeenCalled();
    });

    it('manda la confirmación por WhatsApp usando las credenciales del TENANT', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'aprobador1' });
      prisma.publicacionSocial.findMany.mockResolvedValue([
        { id: 'p1', creadoPorId: 'creador1', producto: { nombre: 'Yogurt Fresa' } },
      ]);
      prisma.whatsappConfigTenant.findUnique.mockResolvedValue({
        twilioAccountSid: 'AC1',
        twilioAuthTokenCifrado: 'iv:tag:cifrado',
        twilioWhatsappFrom: '+15550001111',
      } as never);
      const encriptado = await import('../common/utils/encriptado.util');
      jest.spyOn(encriptado, 'descifrar').mockReturnValue('token-real');
      const enviarSpy = jest.spyOn(twilioWhatsappUtil, 'enviarWhatsappTwilio').mockResolvedValue(true);

      await service.intentarAprobarPorWhatsapp('t1', '+18095551234');

      expect(enviarSpy).toHaveBeenCalledWith(
        expect.objectContaining({ accountSid: 'AC1', from: 'whatsapp:+15550001111', to: '+18095551234' }),
      );
    });
  });
});
