import { BadRequestException } from '@nestjs/common';
import { AusenciasService } from './ausencias.service';
import { AusenciasRepository } from './ausencias.repository';
import { EmpleadosRepository } from './empleados.repository';
import { TiposAusenciaConfigRepository } from './tipos-ausencia-config.repository';

describe('AusenciasService', () => {
  let service: AusenciasService;
  let ausenciasRepository: jest.Mocked<AusenciasRepository>;
  let empleadosRepository: jest.Mocked<EmpleadosRepository>;
  let tiposAusenciaConfigRepository: jest.Mocked<TiposAusenciaConfigRepository>;

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
    // buscarPorTipo resuelve null por defecto — mismo comportamiento que un
    // tenant sin fila de configuración (usa los defaults hardcodeados).
    tiposAusenciaConfigRepository = {
      buscarPorTipo: jest.fn().mockResolvedValue(null),
      sumarDiasAprobadosEnAnio: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<TiposAusenciaConfigRepository>;
    service = new AusenciasService(ausenciasRepository, empleadosRepository, tiposAusenciaConfigRepository);
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

  it('crear rechaza con 400 si el tipo está desactivado por configuración del tenant', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    tiposAusenciaConfigRepository.buscarPorTipo.mockResolvedValue({ activo: false } as never);

    await expect(
      service.crear({ empleadoId: 'e1', tipo: 'OTRO', fechaDesde: '2026-09-01', fechaHasta: '2026-09-01' }, 't1', 'u1'),
    ).rejects.toThrow(BadRequestException);
    expect(ausenciasRepository.crear).not.toHaveBeenCalled();
  });

  it('crear rechaza con 400 si excede el tope de días/año configurado para el tipo (no VACACIONES)', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    tiposAusenciaConfigRepository.buscarPorTipo.mockResolvedValue({ activo: true, maximoDiasPorAnio: 5, conGoceDeSueldoPorDefecto: true, requiereAprobacion: true } as never);
    tiposAusenciaConfigRepository.sumarDiasAprobadosEnAnio.mockResolvedValue(3);

    await expect(
      service.crear({ empleadoId: 'e1', tipo: 'PERMISO', fechaDesde: '2026-09-01', fechaHasta: '2026-09-03' }, 't1', 'u1'),
    ).rejects.toThrow(BadRequestException);
    expect(ausenciasRepository.crear).not.toHaveBeenCalled();
  });

  it('crear permite solicitar dentro del tope de días/año configurado', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    ausenciasRepository.crear.mockResolvedValue({ id: 'a1' } as never);
    tiposAusenciaConfigRepository.buscarPorTipo.mockResolvedValue({ activo: true, maximoDiasPorAnio: 5, conGoceDeSueldoPorDefecto: true, requiereAprobacion: true } as never);
    tiposAusenciaConfigRepository.sumarDiasAprobadosEnAnio.mockResolvedValue(2);

    await service.crear({ empleadoId: 'e1', tipo: 'PERMISO', fechaDesde: '2026-09-01', fechaHasta: '2026-09-01' }, 't1', 'u1');

    expect(ausenciasRepository.crear).toHaveBeenCalled();
  });

  it('crear ignora el tope de días/año configurado para VACACIONES (usa el balance legal)', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1', fechaIngreso: new Date('2020-01-01T00:00:00.000Z') } as never);
    ausenciasRepository.crear.mockResolvedValue({ id: 'a1' } as never);
    tiposAusenciaConfigRepository.buscarPorTipo.mockResolvedValue({ activo: true, maximoDiasPorAnio: 1, conGoceDeSueldoPorDefecto: true, requiereAprobacion: true } as never);

    await service.crear({ empleadoId: 'e1', tipo: 'VACACIONES', fechaDesde: '2026-09-01', fechaHasta: '2026-09-05' }, 't1', 'u1');

    expect(tiposAusenciaConfigRepository.sumarDiasAprobadosEnAnio).not.toHaveBeenCalled();
    expect(ausenciasRepository.crear).toHaveBeenCalled();
  });

  it('crear auto-aprueba cuando el tipo no requiere aprobación', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    ausenciasRepository.crear.mockResolvedValue({ id: 'a1' } as never);
    tiposAusenciaConfigRepository.buscarPorTipo.mockResolvedValue({ activo: true, maximoDiasPorAnio: null, conGoceDeSueldoPorDefecto: true, requiereAprobacion: false } as never);

    await service.crear({ empleadoId: 'e1', tipo: 'OTRO', fechaDesde: '2026-09-01', fechaHasta: '2026-09-01' }, 't1', 'u1');

    expect(ausenciasRepository.crear).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'APROBADA', aprobadoPorId: 'u1', fechaResolucion: expect.any(Date) }),
    );
  });

  it('crear usa conGoceDeSueldoPorDefecto de la configuración del tenant en vez del hardcodeado', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    ausenciasRepository.crear.mockResolvedValue({ id: 'a1' } as never);
    tiposAusenciaConfigRepository.buscarPorTipo.mockResolvedValue({ activo: true, maximoDiasPorAnio: null, conGoceDeSueldoPorDefecto: false, requiereAprobacion: true } as never);

    await service.crear({ empleadoId: 'e1', tipo: 'PERMISO', fechaDesde: '2026-09-01', fechaHasta: '2026-09-01' }, 't1', 'u1');

    expect(ausenciasRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ conGoceDeSueldo: false }));
  });

  it('listar delega en el repositorio con la paginación por defecto', async () => {
    ausenciasRepository.listar.mockResolvedValue([[{ id: 'a1' }], 1] as never);

    const resultado = await service.listar({});

    expect(resultado).toEqual({ datos: [{ id: 'a1' }], total: 1, pagina: 1, tamanoPagina: 20 });
  });
});
