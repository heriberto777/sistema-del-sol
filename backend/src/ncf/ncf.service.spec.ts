import { ConflictException } from '@nestjs/common';
import { NcfService } from './ncf.service';
import { NcfRepository } from './ncf.repository';
import { SucursalesRepository } from '../sucursales/sucursales.repository';

describe('NcfService', () => {
  let service: NcfService;
  let repository: jest.Mocked<NcfRepository>;
  let sucursalesRepository: jest.Mocked<SucursalesRepository>;

  beforeEach(() => {
    repository = {
      listar: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      buscarActivaGlobal: jest.fn().mockResolvedValue(null),
      obtenerModalidad: jest.fn(),
      actualizarModalidad: jest.fn(),
    } as unknown as jest.Mocked<NcfRepository>;
    sucursalesRepository = { buscarPorId: jest.fn() } as unknown as jest.Mocked<SucursalesRepository>;
    service = new NcfService(repository, sucursalesRepository);
  });

  it('obtenerModalidad() delega al repositorio con el tenantId', async () => {
    repository.obtenerModalidad.mockResolvedValue('ECF' as never);

    await expect(service.obtenerModalidad('tenant-1')).resolves.toBe('ECF');
    expect(repository.obtenerModalidad).toHaveBeenCalledWith('tenant-1');
  });

  it('actualizarModalidad() delega al repositorio con tenantId y la modalidad', async () => {
    await service.actualizarModalidad('tenant-1', 'ECF');
    expect(repository.actualizarModalidad).toHaveBeenCalledWith('tenant-1', 'ECF');
  });

  it('crear() usa secuenciaInicial=1 por defecto cuando no se especifica', async () => {
    await service.crear({ tipoNcf: 'B02', secuenciaFinal: 1000, vigenciaHasta: '2027-01-01' }, 'tenant-1');

    expect(repository.crear).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', tipoNcf: 'B02', secuenciaInicial: 1, secuenciaFinal: 1000 }),
    );
  });

  it('crear() respeta una secuenciaInicial explícita', async () => {
    await service.crear(
      { tipoNcf: 'B01', secuenciaInicial: 500, secuenciaFinal: 1000, vigenciaHasta: '2027-01-01' },
      'tenant-1',
    );

    expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ secuenciaInicial: 500 }));
  });

  it('crear() convierte vigenciaHasta (string) a Date', async () => {
    await service.crear({ tipoNcf: 'B02', secuenciaFinal: 1000, vigenciaHasta: '2027-06-15' }, 'tenant-1');

    const [[args]] = repository.crear.mock.calls;
    expect(args.vigenciaHasta).toBeInstanceOf(Date);
    expect(args.vigenciaHasta.toISOString().startsWith('2027-06-15')).toBe(true);
  });

  it('crear() rechaza con 409 si ya existe una secuencia compartida activa del mismo tipo (sin sucursalId)', async () => {
    repository.buscarActivaGlobal.mockResolvedValue({ id: 'ncf-1' } as never);

    await expect(service.crear({ tipoNcf: 'B02', secuenciaFinal: 1000, vigenciaHasta: '2027-01-01' }, 'tenant-1')).rejects.toThrow(
      ConflictException,
    );
    expect(repository.crear).not.toHaveBeenCalled();
  });

  it('crear() valida que sucursalId pertenezca al tenant antes de crear la secuencia', async () => {
    sucursalesRepository.buscarPorId.mockResolvedValue({ id: 's1' } as never);

    await service.crear({ tipoNcf: 'B02', sucursalId: 's1', secuenciaFinal: 1000, vigenciaHasta: '2027-01-01' }, 'tenant-1');

    expect(sucursalesRepository.buscarPorId).toHaveBeenCalledWith('s1');
    expect(repository.buscarActivaGlobal).not.toHaveBeenCalled();
    expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ sucursalId: 's1' }));
  });

  it('actualizar() no convierte vigenciaHasta si no se envía', async () => {
    await service.actualizar('ncf-1', { activo: false });

    expect(repository.actualizar).toHaveBeenCalledWith('ncf-1', {
      secuenciaFinal: undefined,
      vigenciaHasta: undefined,
      activo: false,
      umbralAlerta: undefined,
    });
  });

  it('listar() delega al repositorio', () => {
    service.listar();
    expect(repository.listar).toHaveBeenCalled();
  });
});
