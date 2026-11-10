import { ForbiddenException } from '@nestjs/common';
import { ComentariosDocumentoService } from './comentarios-documento.service';
import { ComentariosDocumentoRepository } from './comentarios-documento.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { JwtPayloadUser } from '../common/types/authenticated-request';

describe('ComentariosDocumentoService', () => {
  let service: ComentariosDocumentoService;
  let repository: jest.Mocked<ComentariosDocumentoRepository>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let cotizacionesService: jest.Mocked<CotizacionesService>;
  let eventBus: jest.Mocked<EventBusService>;

  const USUARIO: JwtPayloadUser = {
    userId: 'autor-1',
    tenantId: 'tenant-1',
    email: 'autor@demo.com',
    roles: ['Admin Total'],
    permisos: ['facturacion.ver', 'cotizaciones.ver'],
  };

  beforeEach(() => {
    repository = {
      listarPorDocumento: jest.fn(),
      crear: jest.fn(),
      buscarUsuariosMencionables: jest.fn(),
      buscarUsuarioPorId: jest.fn(),
    } as unknown as jest.Mocked<ComentariosDocumentoRepository>;
    facturacionService = { buscarPorId: jest.fn() } as unknown as jest.Mocked<FacturacionService>;
    cotizacionesService = { buscarPorId: jest.fn() } as unknown as jest.Mocked<CotizacionesService>;
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new ComentariosDocumentoService(repository, facturacionService, cotizacionesService, eventBus);
  });

  function dto(overrides: Partial<Parameters<ComentariosDocumentoService['crear']>[0]> = {}) {
    return { tipoDocumento: 'FACTURA', documentoId: 'factura-1', texto: 'hola', ...overrides } as Parameters<
      ComentariosDocumentoService['crear']
    >[0];
  }

  describe('crear', () => {
    it('sin el permiso de ver el tipo de documento: ForbiddenException, no crea nada', async () => {
      await expect(service.crear(dto(), { ...USUARIO, permisos: [] })).rejects.toThrow(ForbiddenException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('documento que no existe o no es del tenant: se propaga el 404 de buscarPorId, no crea nada', async () => {
      facturacionService.buscarPorId.mockRejectedValue(new Error('no encontrado'));

      await expect(service.crear(dto(), USUARIO)).rejects.toThrow('no encontrado');
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('usuario mencionado que no existe o no es del tenant: se propaga el 404, no crea nada', async () => {
      facturacionService.buscarPorId.mockResolvedValue({ ncf: 'B0200000010' } as never);
      repository.buscarUsuarioPorId.mockRejectedValue(new Error('no encontrado'));

      await expect(service.crear(dto({ mencionadoId: 'usuario-ajeno' }), USUARIO)).rejects.toThrow('no encontrado');
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('fila válida sin mención: crea el comentario y NO emite ningún evento', async () => {
      facturacionService.buscarPorId.mockResolvedValue({ ncf: 'B0200000010' } as never);
      repository.crear.mockResolvedValue({ id: 'comentario-1', autor: { id: 'autor-1', nombre: 'Autor Uno' } } as never);

      const resultado = await service.crear(dto(), USUARIO);

      expect(resultado).toEqual(expect.objectContaining({ id: 'comentario-1' }));
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('con mención a otro usuario: valida al mencionado, crea el comentario y emite COMENTARIO_DOCUMENTO_MENCION con la etiqueta del documento (NCF)', async () => {
      facturacionService.buscarPorId.mockResolvedValue({ ncf: 'B0200000010' } as never);
      repository.buscarUsuarioPorId.mockResolvedValue({ id: 'mencionado-1' } as never);
      repository.crear.mockResolvedValue({ id: 'comentario-1', autor: { id: 'autor-1', nombre: 'Autor Uno' } } as never);

      await service.crear(dto({ mencionadoId: 'mencionado-1' }), USUARIO);

      expect(repository.buscarUsuarioPorId).toHaveBeenCalledWith('mencionado-1');
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.COMENTARIO_DOCUMENTO_MENCION,
        expect.objectContaining({
          tenantId: 'tenant-1',
          comentarioId: 'comentario-1',
          autorNombre: 'Autor Uno',
          mencionadoId: 'mencionado-1',
          tipoDocumentoEtiqueta: 'Factura',
          documentoEtiqueta: 'B0200000010',
          texto: 'hola',
        }),
      );
    });

    it('cotización: usa CotizacionesService y el número como etiqueta (no NCF)', async () => {
      cotizacionesService.buscarPorId.mockResolvedValue({ numero: 'COT-00042' } as never);
      repository.buscarUsuarioPorId.mockResolvedValue({ id: 'mencionado-1' } as never);
      repository.crear.mockResolvedValue({ id: 'comentario-1', autor: { id: 'autor-1', nombre: 'Autor Uno' } } as never);

      await service.crear(dto({ tipoDocumento: 'COTIZACION', documentoId: 'cot-1', mencionadoId: 'mencionado-1' }), USUARIO);

      expect(facturacionService.buscarPorId).not.toHaveBeenCalled();
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.COMENTARIO_DOCUMENTO_MENCION,
        expect.objectContaining({ tipoDocumentoEtiqueta: 'Cotización', documentoEtiqueta: 'COT-00042' }),
      );
    });

    it('mencionarse a sí mismo: crea el comentario pero NO emite el evento (no tiene sentido notificarte de tu propio comentario)', async () => {
      facturacionService.buscarPorId.mockResolvedValue({ ncf: 'B0200000010' } as never);
      repository.crear.mockResolvedValue({ id: 'comentario-1', autor: { id: 'autor-1', nombre: 'Autor Uno' } } as never);

      await service.crear(dto({ mencionadoId: USUARIO.userId }), USUARIO);

      // Se menciona a sí mismo — no hace falta validar "contra el tenant" a nadie más, pero tampoco debería notificar.
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('sin el permiso de ver el tipo de documento: ForbiddenException', async () => {
      await expect(service.listar('COTIZACION', 'cot-1', { ...USUARIO, permisos: [] })).rejects.toThrow(ForbiddenException);
    });

    it('documento válido: valida pertenencia y delega en el repositorio', async () => {
      cotizacionesService.buscarPorId.mockResolvedValue({ numero: 'COT-00042' } as never);
      repository.listarPorDocumento.mockResolvedValue([{ id: 'c1' }] as never);

      const resultado = await service.listar('COTIZACION', 'cot-1', USUARIO);

      expect(cotizacionesService.buscarPorId).toHaveBeenCalledWith('cot-1');
      expect(resultado).toEqual([{ id: 'c1' }]);
    });
  });

  it('buscarUsuariosMencionables delega en el repositorio', async () => {
    repository.buscarUsuariosMencionables.mockResolvedValue([{ id: 'u1', nombre: 'Fulano' }] as never);

    const resultado = await service.buscarUsuariosMencionables('ful');

    expect(repository.buscarUsuariosMencionables).toHaveBeenCalledWith('ful');
    expect(resultado).toEqual([{ id: 'u1', nombre: 'Fulano' }]);
  });
});
