import { BadRequestException } from '@nestjs/common';
import { AusenciasService } from './ausencias.service';
import { AusenciasRepository } from './ausencias.repository';
import { EmpleadosRepository } from './empleados.repository';

describe('AusenciasService', () => {
  let service: AusenciasService;
  let ausenciasRepository: jest.Mocked<AusenciasRepository>;
  let empleadosRepository: jest.Mocked<EmpleadosRepository>;

  beforeEach(() => {
    ausenciasRepository = {
      crear: jest.fn(),
      buscarPorId: jest.fn(),
      actualizarEstado: jest.fn(),
      listar: jest.fn(),
      listarVacacionesAprobadas: jest.fn().mockResolvedValue([]),
      listarSinGoceSolapadas: jest.fn(),
    } as unknown as jest.Mocked<AusenciasRepository>;
    empleadosRepository = { buscarPorId: jest.fn() } as unknown as jest.Mocked<EmpleadosRepository>;
    service = new AusenciasService(ausenciasRepository, empleadosRepository);
  });

  it('crear valida que el empleado pertenezca al tenant', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    ausenciasRepository.crear.mockResolvedValue({ id: 'a1' } as never);

    await service.crear({ empleadoId: 'e1', tipo: 'PERMISO', fechaDesde: '2026-09-01', fechaHasta: '2026-09-02' }, 't1', 'u1');

    expect(empleadosRepository.buscarPorId).toHaveBeenCalledWith('e1');
  });

  it('crear infiere conGoceDeSueldo=false para INJUSTIFICADA sin que el caller lo indique', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    ausenciasRepository.crear.mockResolvedValue({ id: 'a1' } as never);

    await service.crear({ empleadoId: 'e1', tipo: 'INJUSTIFICADA', fechaDesde: '2026-09-01', fechaHasta: '2026-09-01' }, 't1', 'u1');

    expect(ausenciasRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ conGoceDeSueldo: false }));
  });

  it('crear infiere conGoceDeSueldo=true para VACACIONES sin que el caller lo indique', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1', fechaIngreso: new Date('2020-01-01T00:00:00.000Z') } as never);
    ausenciasRepository.crear.mockResolvedValue({ id: 'a1' } as never);

    await service.crear({ empleadoId: 'e1', tipo: 'VACACIONES', fechaDesde: '2026-09-01', fechaHasta: '2026-09-05' }, 't1', 'u1');

    expect(ausenciasRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ conGoceDeSueldo: true }));
  });

  it('crear respeta conGoceDeSueldo explícito aunque contradiga el default del tipo', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1', fechaIngreso: new Date('2020-01-01T00:00:00.000Z') } as never);
    ausenciasRepository.crear.mockResolvedValue({ id: 'a1' } as never);

    await service.crear(
      { empleadoId: 'e1', tipo: 'VACACIONES', fechaDesde: '2026-09-01', fechaHasta: '2026-09-05', conGoceDeSueldo: false },
      't1',
      'u1',
    );

    expect(ausenciasRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ conGoceDeSueldo: false }));
  });

  it('crear VACACIONES rechaza con 400 si excede el balance disponible', async () => {
    // 2020-01-01 -> 6 años cumplidos a 2026-09-01 => 84 días acumulados, ninguno tomado.
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1', fechaIngreso: new Date('2020-01-01T00:00:00.000Z') } as never);
    // 2026-09-01 es martes; pedir 90 días laborables seguidos excede el balance de 84.
    const fechaHasta = new Date('2026-09-01T00:00:00.000Z');
    fechaHasta.setUTCDate(fechaHasta.getUTCDate() + 104); // ~90 días no domingo
    await expect(
      service.crear(
        { empleadoId: 'e1', tipo: 'VACACIONES', fechaDesde: '2026-09-01', fechaHasta: fechaHasta.toISOString().slice(0, 10) },
        't1',
        'u1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(ausenciasRepository.crear).not.toHaveBeenCalled();
  });

  it('crear VACACIONES permite solicitar dentro del balance disponible, descontando lo ya tomado', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1', fechaIngreso: new Date('2020-01-01T00:00:00.000Z') } as never);
    ausenciasRepository.crear.mockResolvedValue({ id: 'a1' } as never);
    // Ya tomó 72 de los 84 días acumulados (6 años) -> quedan 12 disponibles.
    ausenciasRepository.listarVacacionesAprobadas.mockResolvedValue([
      { fechaDesde: new Date('2025-01-01T00:00:00.000Z'), fechaHasta: new Date('2025-03-25T00:00:00.000Z') },
    ] as never);

    await service.crear({ empleadoId: 'e1', tipo: 'VACACIONES', fechaDesde: '2026-09-01', fechaHasta: '2026-09-03' }, 't1', 'u1');

    expect(ausenciasRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'VACACIONES' }));
  });

  it('crear rechaza con 400 si fechaHasta es anterior a fechaDesde', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);

    await expect(
      service.crear({ empleadoId: 'e1', tipo: 'PERMISO', fechaDesde: '2026-09-05', fechaHasta: '2026-09-01' }, 't1', 'u1'),
    ).rejects.toThrow(BadRequestException);
    expect(ausenciasRepository.crear).not.toHaveBeenCalled();
  });

  it('cambiarEstado aprueba una ausencia SOLICITADA', async () => {
    ausenciasRepository.buscarPorId.mockResolvedValue({ id: 'a1', estado: 'SOLICITADA' } as never);
    ausenciasRepository.actualizarEstado.mockResolvedValue({ id: 'a1', estado: 'APROBADA' } as never);

    await service.cambiarEstado('a1', 'APROBADA', 'u2');

    expect(ausenciasRepository.actualizarEstado).toHaveBeenCalledWith('a1', 'APROBADA', 'u2', expect.any(Date));
  });

  it('cambiarEstado rechaza con 400 si la ausencia ya fue resuelta', async () => {
    ausenciasRepository.buscarPorId.mockResolvedValue({ id: 'a1', estado: 'APROBADA' } as never);

    await expect(service.cambiarEstado('a1', 'RECHAZADA', 'u2')).rejects.toThrow(BadRequestException);
    expect(ausenciasRepository.actualizarEstado).not.toHaveBeenCalled();
  });

  it('listar delega en el repositorio con la paginación por defecto', async () => {
    ausenciasRepository.listar.mockResolvedValue([[{ id: 'a1' }], 1] as never);

    const resultado = await service.listar({});

    expect(resultado).toEqual({ datos: [{ id: 'a1' }], total: 1, pagina: 1, tamanoPagina: 20 });
  });
});
