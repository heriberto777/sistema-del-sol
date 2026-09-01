import { ConflictException } from '@nestjs/common';
import { NcfPlataformaService } from './ncf-plataforma.service';
import { NcfPlataformaRepository } from './ncf-plataforma.repository';
import { PlataformaConfigRepository } from '../plataforma-config/plataforma-config.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('NcfPlataformaService', () => {
  let service: NcfPlataformaService;
  let repository: jest.Mocked<NcfPlataformaRepository>;
  let plataformaConfigRepository: jest.Mocked<PlataformaConfigRepository>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    repository = {
      listar: jest.fn(),
      buscarActiva: jest.fn().mockResolvedValue(null),
      crear: jest.fn(),
      actualizar: jest.fn(),
      siguienteEnTx: jest.fn(),
    } as unknown as jest.Mocked<NcfPlataformaRepository>;
    plataformaConfigRepository = {
      obtenerOCrear: jest.fn().mockResolvedValue({ modalidadFacturacion: 'NCF' }),
    } as unknown as jest.Mocked<PlataformaConfigRepository>;
    prisma = { $transaction: jest.fn((cb) => cb('tx-fake')) } as unknown as jest.Mocked<PrismaService>;
    service = new NcfPlataformaService(repository, plataformaConfigRepository, prisma);
  });

  describe('crear', () => {
    it('rechaza con 409 si ya existe una secuencia activa del mismo tipo', async () => {
      repository.buscarActiva.mockResolvedValue({ id: 'ncf-1' } as never);

      await expect(service.crear({ tipoNcf: 'B01', secuenciaFinal: 1000, vigenciaHasta: '2027-01-01' })).rejects.toThrow(
        ConflictException,
      );
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('crea con secuenciaInicial=1 por defecto', async () => {
      await service.crear({ tipoNcf: 'B01', secuenciaFinal: 1000, vigenciaHasta: '2027-01-01' });
      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ tipoNcf: 'B01', secuenciaInicial: 1, secuenciaFinal: 1000 }));
    });
  });

  describe('asignarSiguiente', () => {
    it('devuelve el NCF cuando hay una secuencia activa disponible — B01 en modalidad NCF', async () => {
      repository.siguienteEnTx.mockResolvedValue({ ncf: 'B0100000001', tipoNcf: 'B01' });

      const resultado = await service.asignarSiguiente();

      expect(resultado).toEqual({ ncf: 'B0100000001', tipoNcf: 'B01' });
      expect(repository.siguienteEnTx).toHaveBeenCalledWith('tx-fake', 'B01');
    });

    it('resuelve E31 en vez de B01 cuando la modalidad de plataforma es ECF', async () => {
      plataformaConfigRepository.obtenerOCrear.mockResolvedValue({ modalidadFacturacion: 'ECF' } as never);
      repository.siguienteEnTx.mockResolvedValue({ ncf: 'E3100000001', tipoNcf: 'E31' });

      await service.asignarSiguiente();

      expect(repository.siguienteEnTx).toHaveBeenCalledWith('tx-fake', 'E31');
    });

    it('devuelve null sin lanzar cuando no hay ninguna secuencia activa configurada', async () => {
      repository.siguienteEnTx.mockRejectedValue(new Error('No NcfPlataforma found'));

      await expect(service.asignarSiguiente()).resolves.toBeNull();
    });

    it('devuelve null sin lanzar cuando la secuencia activa ya está agotada', async () => {
      repository.siguienteEnTx.mockRejectedValue(new Error('Secuencia de NCF de plataforma B01 agotada'));

      await expect(service.asignarSiguiente()).resolves.toBeNull();
    });
  });
});
