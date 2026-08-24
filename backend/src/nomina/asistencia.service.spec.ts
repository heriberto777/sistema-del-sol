import { BadRequestException } from '@nestjs/common';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaRepository } from './asistencia.repository';
import { EmpleadosRepository } from './empleados.repository';
import { HorariosRepository } from './horarios.repository';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';
import * as zonaHorariaRd from '../common/utils/zona-horaria-rd.util';

jest.mock('../common/utils/zona-horaria-rd.util');

describe('AsistenciaService', () => {
  let service: AsistenciaService;
  let asistenciaRepository: jest.Mocked<AsistenciaRepository>;
  let empleadosRepository: jest.Mocked<EmpleadosRepository>;
  let horariosRepository: jest.Mocked<HorariosRepository>;
  let configuracionesService: jest.Mocked<ConfiguracionesService>;

  beforeEach(() => {
    asistenciaRepository = {
      buscarDelDia: jest.fn(),
      buscarPorId: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      actualizarEstado: jest.fn(),
      listar: jest.fn(),
    } as unknown as jest.Mocked<AsistenciaRepository>;
    empleadosRepository = { buscarPorUserId: jest.fn(), buscarPorId: jest.fn() } as unknown as jest.Mocked<EmpleadosRepository>;
    horariosRepository = { listarPorEmpleado: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<HorariosRepository>;
    configuracionesService = { buscarValor: jest.fn().mockImplementation((_c, _t, def) => Promise.resolve(def)) } as unknown as jest.Mocked<ConfiguracionesService>;
    service = new AsistenciaService(asistenciaRepository, empleadosRepository, horariosRepository, configuracionesService);

    // Lunes 2026-08-24 (getUTCDay() === 1), 08:15 RD.
    (zonaHorariaRd.fechaHoyRD as jest.Mock).mockReturnValue('2026-08-24');
    (zonaHorariaRd.horaActualRD as jest.Mock).mockReturnValue('08:15');
  });

  it('miEstadoHoy devuelve tieneEmpleado=false sin consultar asistencia si el usuario no está vinculado', async () => {
    empleadosRepository.buscarPorUserId.mockResolvedValue(null as never);

    const resultado = await service.miEstadoHoy('u1', 't1');

    expect(resultado).toEqual({ tieneEmpleado: false, registro: null });
    expect(asistenciaRepository.buscarDelDia).not.toHaveBeenCalled();
  });

  it('miEstadoHoy devuelve el registro de hoy si el usuario sí tiene empleado vinculado', async () => {
    empleadosRepository.buscarPorUserId.mockResolvedValue({ id: 'e1' } as never);
    asistenciaRepository.buscarDelDia.mockResolvedValue({ id: 'r1', horaEntrada: '08:15', horaSalida: null } as never);

    const resultado = await service.miEstadoHoy('u1', 't1');

    expect(resultado).toEqual({ tieneEmpleado: true, registro: { id: 'r1', horaEntrada: '08:15', horaSalida: null } });
  });

  it('marcarEntrada rechaza con 400 si el usuario no tiene empleado vinculado', async () => {
    empleadosRepository.buscarPorUserId.mockResolvedValue(null as never);

    await expect(service.marcarEntrada('u1', 't1')).rejects.toThrow(BadRequestException);
  });

  it('marcarEntrada crea el registro y marca tardanza si llega después de HorarioEmpleado', async () => {
    empleadosRepository.buscarPorUserId.mockResolvedValue({ id: 'e1' } as never);
    asistenciaRepository.buscarDelDia.mockResolvedValue(null);
    horariosRepository.listarPorEmpleado.mockResolvedValue([{ diaSemana: 'LUNES', horaEntrada: '08:00', horaSalida: '17:00' }] as never);
    asistenciaRepository.crear.mockResolvedValue({ id: 'r1' } as never);

    await service.marcarEntrada('u1', 't1');

    expect(asistenciaRepository.crear).toHaveBeenCalledWith({
      tenantId: 't1',
      empleadoId: 'e1',
      fecha: new Date('2026-08-24T00:00:00.000Z'),
      horaEntrada: '08:15',
      tardanza: true,
    });
  });

  it('marcarEntrada no marca tardanza si el empleado no tiene horario configurado ese día', async () => {
    empleadosRepository.buscarPorUserId.mockResolvedValue({ id: 'e1' } as never);
    asistenciaRepository.buscarDelDia.mockResolvedValue(null);
    horariosRepository.listarPorEmpleado.mockResolvedValue([] as never);
    asistenciaRepository.crear.mockResolvedValue({ id: 'r1' } as never);

    await service.marcarEntrada('u1', 't1');

    expect(asistenciaRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ tardanza: false }));
  });

  it('marcarEntrada rechaza con 400 si ya se marcó la entrada de hoy', async () => {
    empleadosRepository.buscarPorUserId.mockResolvedValue({ id: 'e1' } as never);
    asistenciaRepository.buscarDelDia.mockResolvedValue({ id: 'r1', horaEntrada: '08:00' } as never);

    await expect(service.marcarEntrada('u1', 't1')).rejects.toThrow(BadRequestException);
    expect(asistenciaRepository.crear).not.toHaveBeenCalled();
  });

  it('marcarSalida rechaza con 400 si todavía no se marcó la entrada', async () => {
    empleadosRepository.buscarPorUserId.mockResolvedValue({ id: 'e1' } as never);
    asistenciaRepository.buscarDelDia.mockResolvedValue(null);

    await expect(service.marcarSalida('u1', 't1')).rejects.toThrow(BadRequestException);
  });

  it('marcarSalida rechaza con 400 si ya se marcó la salida de hoy', async () => {
    empleadosRepository.buscarPorUserId.mockResolvedValue({ id: 'e1' } as never);
    asistenciaRepository.buscarDelDia.mockResolvedValue({ id: 'r1', horaEntrada: '08:00', horaSalida: '17:00' } as never);

    await expect(service.marcarSalida('u1', 't1')).rejects.toThrow(BadRequestException);
  });

  it('marcarSalida actualiza horaSalida cuando corresponde (sin horario configurado, sin excedente de horas)', async () => {
    empleadosRepository.buscarPorUserId.mockResolvedValue({ id: 'e1' } as never);
    asistenciaRepository.buscarDelDia.mockResolvedValue({ id: 'r1', horaEntrada: '08:00', horaSalida: null } as never);
    asistenciaRepository.actualizar.mockResolvedValue({ id: 'r1' } as never);

    await service.marcarSalida('u1', 't1');

    expect(asistenciaRepository.actualizar).toHaveBeenCalledWith('r1', {
      horaSalida: '08:15',
      salidaAnticipada: false,
      horasExtra: 0,
    });
  });

  describe('salidaAnticipada / horasExtra (plan de integración Cuadre, ítem G-4)', () => {
    it('marca salidaAnticipada si sale antes de HorarioEmpleado menos la tolerancia configurada', async () => {
      empleadosRepository.buscarPorUserId.mockResolvedValue({ id: 'e1' } as never);
      asistenciaRepository.buscarDelDia.mockResolvedValue({ id: 'r1', horaEntrada: '08:00', horaSalida: null } as never);
      horariosRepository.listarPorEmpleado.mockResolvedValue([{ diaSemana: 'LUNES', horaEntrada: '08:00', horaSalida: '17:00' }] as never);
      (zonaHorariaRd.horaActualRD as jest.Mock).mockReturnValue('16:30'); // sale 30 min antes, tolerancia default 15
      asistenciaRepository.actualizar.mockResolvedValue({ id: 'r1' } as never);

      await service.marcarSalida('u1', 't1');

      expect(asistenciaRepository.actualizar).toHaveBeenCalledWith('r1', expect.objectContaining({ salidaAnticipada: true }));
    });

    it('no marca salidaAnticipada si sale dentro de la tolerancia configurada', async () => {
      empleadosRepository.buscarPorUserId.mockResolvedValue({ id: 'e1' } as never);
      asistenciaRepository.buscarDelDia.mockResolvedValue({ id: 'r1', horaEntrada: '08:00', horaSalida: null } as never);
      horariosRepository.listarPorEmpleado.mockResolvedValue([{ diaSemana: 'LUNES', horaEntrada: '08:00', horaSalida: '17:00' }] as never);
      (zonaHorariaRd.horaActualRD as jest.Mock).mockReturnValue('16:50'); // 10 min antes, tolerancia default 15
      asistenciaRepository.actualizar.mockResolvedValue({ id: 'r1' } as never);

      await service.marcarSalida('u1', 't1');

      expect(asistenciaRepository.actualizar).toHaveBeenCalledWith('r1', expect.objectContaining({ salidaAnticipada: false }));
    });

    it('calcula horasExtra como el excedente sobre el umbral configurado (default 8h/día)', async () => {
      empleadosRepository.buscarPorUserId.mockResolvedValue({ id: 'e1' } as never);
      asistenciaRepository.buscarDelDia.mockResolvedValue({ id: 'r1', horaEntrada: '08:00', horaSalida: null } as never);
      (zonaHorariaRd.horaActualRD as jest.Mock).mockReturnValue('18:00'); // 10 horas trabajadas
      asistenciaRepository.actualizar.mockResolvedValue({ id: 'r1' } as never);

      await service.marcarSalida('u1', 't1');

      expect(asistenciaRepository.actualizar).toHaveBeenCalledWith('r1', expect.objectContaining({ horasExtra: 2 }));
    });

    it('horasExtra queda null si no hay horaEntrada registrada (no se puede calcular)', async () => {
      empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
      asistenciaRepository.buscarDelDia.mockResolvedValue({ id: 'r1', horaEntrada: null, horaSalida: null, tardanza: false } as never);
      asistenciaRepository.actualizar.mockResolvedValue({ id: 'r1' } as never);

      await service.registrarManual({ empleadoId: 'e1', fecha: '2026-08-24', horaSalida: '17:00' }, 't1');

      expect(asistenciaRepository.actualizar).toHaveBeenCalledWith('r1', expect.objectContaining({ horasExtra: null }));
    });
  });

  it('registrarManual valida que el empleado pertenezca al tenant antes de crear', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    asistenciaRepository.buscarDelDia.mockResolvedValue(null);
    horariosRepository.listarPorEmpleado.mockResolvedValue([] as never);
    asistenciaRepository.crear.mockResolvedValue({ id: 'r1' } as never);

    await service.registrarManual({ empleadoId: 'e1', fecha: '2026-08-24', horaEntrada: '08:05' }, 't1');

    expect(empleadosRepository.buscarPorId).toHaveBeenCalledWith('e1');
    expect(asistenciaRepository.crear).toHaveBeenCalledWith(
      expect.objectContaining({ empleadoId: 'e1', horaEntrada: '08:05', horaSalida: undefined }),
    );
  });

  it('registrarManual sobre un registro existente conserva los campos no enviados', async () => {
    empleadosRepository.buscarPorId.mockResolvedValue({ id: 'e1' } as never);
    asistenciaRepository.buscarDelDia.mockResolvedValue({ id: 'r1', horaEntrada: '08:00', horaSalida: null, tardanza: false } as never);
    asistenciaRepository.actualizar.mockResolvedValue({ id: 'r1' } as never);

    await service.registrarManual({ empleadoId: 'e1', fecha: '2026-08-24', horaSalida: '17:10' }, 't1');

    expect(asistenciaRepository.actualizar).toHaveBeenCalledWith('r1', {
      horaEntrada: '08:00',
      horaSalida: '17:10',
      tardanza: false,
      salidaAnticipada: false,
      horasExtra: 1.17,
    });
  });

  it('listar delega en el repositorio con la paginación por defecto', async () => {
    asistenciaRepository.listar.mockResolvedValue([[{ id: 'r1' }], 1] as never);

    const resultado = await service.listar({});

    expect(resultado).toEqual({ datos: [{ id: 'r1' }], total: 1, pagina: 1, tamanoPagina: 20 });
  });

  describe('cambiarEstado (plan de integración Cuadre, ítem G-3)', () => {
    it('aprueba un registro PENDIENTE', async () => {
      asistenciaRepository.buscarPorId.mockResolvedValue({ id: 'r1', estado: 'PENDIENTE' } as never);
      asistenciaRepository.actualizarEstado.mockResolvedValue({ id: 'r1', estado: 'APROBADO' } as never);

      await service.cambiarEstado('r1', 'APROBADO', 'supervisor1');

      expect(asistenciaRepository.actualizarEstado).toHaveBeenCalledWith('r1', 'APROBADO', 'supervisor1', expect.any(Date));
    });

    it('rechaza cambiar el estado de un registro que ya no está PENDIENTE', async () => {
      asistenciaRepository.buscarPorId.mockResolvedValue({ id: 'r1', estado: 'APROBADO' } as never);

      await expect(service.cambiarEstado('r1', 'RECHAZADO', 'supervisor1')).rejects.toThrow(BadRequestException);
      expect(asistenciaRepository.actualizarEstado).not.toHaveBeenCalled();
    });
  });
});
