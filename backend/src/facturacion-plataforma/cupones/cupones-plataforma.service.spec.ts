import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CuponesPlataformaService } from './cupones-plataforma.service';
import { CuponesPlataformaRepository } from './cupones-plataforma.repository';
import { SuscripcionesRepository } from '../suscripciones.repository';

describe('CuponesPlataformaService', () => {
  let service: CuponesPlataformaService;
  let cuponesRepository: jest.Mocked<CuponesPlataformaRepository>;
  let suscripcionesRepository: jest.Mocked<SuscripcionesRepository>;

  beforeEach(() => {
    cuponesRepository = {
      listar: jest.fn(),
      buscarPorCodigo: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      incrementarUso: jest.fn().mockResolvedValue(undefined),
      desactivarAplicacionesActivas: jest.fn().mockResolvedValue(undefined),
      crearAplicacion: jest.fn(),
      buscarAplicacionActiva: jest.fn(),
      listarAplicacionesDeCupon: jest.fn(),
    } as unknown as jest.Mocked<CuponesPlataformaRepository>;
    suscripcionesRepository = {
      buscarPorTenant: jest.fn().mockResolvedValue({ id: 's1', tenantId: 't1' }),
    } as unknown as jest.Mocked<SuscripcionesRepository>;
    service = new CuponesPlataformaService(cuponesRepository, suscripcionesRepository);
  });

  describe('crear', () => {
    it('guarda el código en mayúsculas', async () => {
      cuponesRepository.crear.mockResolvedValue({ id: 'c1' } as never);
      await service.crear({ codigo: 'bienvenida20', tipo: 'PORCENTAJE', valor: 20 } as never);
      expect(cuponesRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'BIENVENIDA20' }));
    });
  });

  describe('aplicarATenant', () => {
    it('rechaza con 404 si el código no existe', async () => {
      cuponesRepository.buscarPorCodigo.mockResolvedValue(null);
      await expect(service.aplicarATenant('t1', 'NOEXISTE')).rejects.toThrow(NotFoundException);
    });

    it('rechaza con 400 si el cupón está desactivado', async () => {
      cuponesRepository.buscarPorCodigo.mockResolvedValue({ id: 'c1', activo: false } as never);
      await expect(service.aplicarATenant('t1', 'X')).rejects.toThrow(BadRequestException);
    });

    it('rechaza con 400 si el cupón ya expiró', async () => {
      cuponesRepository.buscarPorCodigo.mockResolvedValue({ id: 'c1', activo: true, fechaExpiracion: new Date('2020-01-01') } as never);
      await expect(service.aplicarATenant('t1', 'X')).rejects.toThrow(BadRequestException);
    });

    it('rechaza con 400 si ya alcanzó el tope de usos', async () => {
      cuponesRepository.buscarPorCodigo.mockResolvedValue({ id: 'c1', activo: true, fechaExpiracion: null, usosMaximos: 5, usosActuales: 5 } as never);
      await expect(service.aplicarATenant('t1', 'X')).rejects.toThrow(BadRequestException);
    });

    it('aplica el cupón: desactiva cualquier aplicación previa, crea la nueva, e incrementa el contador de usos', async () => {
      cuponesRepository.buscarPorCodigo.mockResolvedValue({
        id: 'c1',
        activo: true,
        fechaExpiracion: null,
        usosMaximos: null,
        usosActuales: 2,
        duracionCiclos: 3,
      } as never);
      cuponesRepository.buscarAplicacionActiva.mockResolvedValue({ id: 'sc1' } as never);

      await service.aplicarATenant('t1', 'promo10');

      expect(cuponesRepository.desactivarAplicacionesActivas).toHaveBeenCalledWith('s1');
      expect(cuponesRepository.crearAplicacion).toHaveBeenCalledWith({ suscripcionId: 's1', cuponId: 'c1', ciclosRestantes: 3 });
      expect(cuponesRepository.incrementarUso).toHaveBeenCalledWith('c1');
    });

    it('busca el código en mayúsculas sin importar cómo lo tipeen', async () => {
      cuponesRepository.buscarPorCodigo.mockResolvedValue(null);
      await expect(service.aplicarATenant('t1', 'promo10')).rejects.toThrow(NotFoundException);
      expect(cuponesRepository.buscarPorCodigo).toHaveBeenCalledWith('PROMO10');
    });
  });

  describe('listarAplicaciones', () => {
    it('aplana el tenant de la suscripción anidada, sin el resto de la estructura de Prisma', async () => {
      cuponesRepository.listarAplicacionesDeCupon.mockResolvedValue([
        {
          id: 'sc1',
          ciclosRestantes: 2,
          activo: true,
          fechaAplicado: new Date('2026-09-01'),
          suscripcion: { tenant: { id: 't1', nombre: 'Boutique Amantina' } },
        },
      ] as never);

      const resultado = await service.listarAplicaciones('c1');

      expect(resultado).toEqual([
        {
          id: 'sc1',
          ciclosRestantes: 2,
          activo: true,
          fechaAplicado: new Date('2026-09-01'),
          tenant: { id: 't1', nombre: 'Boutique Amantina' },
        },
      ]);
      expect(cuponesRepository.listarAplicacionesDeCupon).toHaveBeenCalledWith('c1');
    });
  });

  describe('quitarDeTenant', () => {
    it('desactiva la aplicación activa de la suscripción del tenant', async () => {
      await service.quitarDeTenant('t1');
      expect(cuponesRepository.desactivarAplicacionesActivas).toHaveBeenCalledWith('s1');
    });
  });
});
