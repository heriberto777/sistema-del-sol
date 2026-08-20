import { BadRequestException } from '@nestjs/common';
import { HorariosService } from './horarios.service';
import { HorariosRepository } from './horarios.repository';
import { EmpleadosRepository } from './empleados.repository';

describe('HorariosService', () => {
  let service: HorariosService;
  let horariosRepository: jest.Mocked<HorariosRepository>;
  let empleadosRepository: jest.Mocked<EmpleadosRepository>;

  beforeEach(() => {
    horariosRepository = { listarPorEmpleado: jest.fn(), reemplazar: jest.fn() } as unknown as jest.Mocked<HorariosRepository>;
    empleadosRepository = { buscarPorId: jest.fn() } as unknown as jest.Mocked<EmpleadosRepository>;
    service = new HorariosService(horariosRepository, empleadosRepository);
  });

  it('listar valida que el empleado pertenezca al tenant antes de consultar horarios', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    horariosRepository.listarPorEmpleado.mockResolvedValue([] as never);

    await service.listar('e1');

    expect(empleadosRepository.buscarPorId).toHaveBeenCalledWith('e1');
    expect(horariosRepository.listarPorEmpleado).toHaveBeenCalledWith('e1');
  });

  it('reemplazar borra y recrea las filas (patrón ComponenteCombo)', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    horariosRepository.reemplazar.mockResolvedValue([] as never);

    const dias = [
      { diaSemana: 'LUNES' as const, horaEntrada: '08:00', horaSalida: '17:00' },
      { diaSemana: 'MARTES' as const, horaEntrada: '08:00', horaSalida: '17:00' },
    ];

    await service.reemplazar('e1', 't1', { dias });

    expect(horariosRepository.reemplazar).toHaveBeenCalledWith('t1', 'e1', dias);
  });

  it('rechaza con 400 si hay un día repetido', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);

    const dias = [
      { diaSemana: 'LUNES' as const, horaEntrada: '08:00', horaSalida: '17:00' },
      { diaSemana: 'LUNES' as const, horaEntrada: '09:00', horaSalida: '18:00' },
    ];

    await expect(service.reemplazar('e1', 't1', { dias })).rejects.toThrow(BadRequestException);
    expect(horariosRepository.reemplazar).not.toHaveBeenCalled();
  });

  it('rechaza con 400 si horaSalida no es posterior a horaEntrada', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);

    const dias = [{ diaSemana: 'LUNES' as const, horaEntrada: '17:00', horaSalida: '08:00' }];

    await expect(service.reemplazar('e1', 't1', { dias })).rejects.toThrow(BadRequestException);
    expect(horariosRepository.reemplazar).not.toHaveBeenCalled();
  });

  it('reemplazar con array vacío deja al empleado sin ningún día configurado', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    horariosRepository.reemplazar.mockResolvedValue([] as never);

    await service.reemplazar('e1', 't1', { dias: [] });

    expect(horariosRepository.reemplazar).toHaveBeenCalledWith('t1', 'e1', []);
  });
});
