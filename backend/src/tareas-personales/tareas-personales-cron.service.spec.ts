import { TareasPersonalesCronService } from './tareas-personales-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

describe('TareasPersonalesCronService', () => {
  let service: TareasPersonalesCronService;
  let prisma: { tareaPersonal: { findMany: jest.Mock; update: jest.Mock } };
  let eventBus: jest.Mocked<EventBusService>;

  const tareaBase = { id: 'ta1', tenantId: 't1', titulo: 'Backup mensual', usuarioId: 'u1' };

  beforeEach(() => {
    prisma = { tareaPersonal: { findMany: jest.fn(), update: jest.fn() } };
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new TareasPersonalesCronService(prisma as unknown as PrismaService, eventBus);
  });

  it('emite el evento y marca recordatorioEnviado para cada tarea que vence hoy', async () => {
    prisma.tareaPersonal.findMany.mockResolvedValue([tareaBase]);

    const cantidad = await service.avisarTareasQueVencenHoy();

    expect(cantidad).toBe(1);
    expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.TAREA_PERSONAL_VENCE_HOY, {
      tenantId: 't1',
      tareaId: 'ta1',
      tareaTitulo: 'Backup mensual',
      usuarioId: 'u1',
    });
    expect(prisma.tareaPersonal.update).toHaveBeenCalledWith({ where: { id: 'ta1' }, data: { recordatorioEnviado: true } });
  });

  it('la query excluye tareas HECHA/con recordatorioEnviado (delegado en el where de Prisma)', async () => {
    prisma.tareaPersonal.findMany.mockResolvedValue([]);

    await service.avisarTareasQueVencenHoy();

    const where = prisma.tareaPersonal.findMany.mock.calls[0][0].where;
    expect(where.estado).toEqual({ in: ['PENDIENTE', 'EN_CURSO', 'EN_ESPERA'] });
    expect(where.recordatorioEnviado).toBe(false);
    expect(where.fecha.gte).toBeInstanceOf(Date);
    expect(where.fecha.lt).toBeInstanceOf(Date);
  });

  it('no hace nada si no hay tareas que venzan hoy', async () => {
    prisma.tareaPersonal.findMany.mockResolvedValue([]);

    const cantidad = await service.avisarTareasQueVencenHoy();

    expect(cantidad).toBe(0);
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(prisma.tareaPersonal.update).not.toHaveBeenCalled();
  });

  it('avisa varias tareas de distintos usuarios/tenants en la misma corrida', async () => {
    prisma.tareaPersonal.findMany.mockResolvedValue([tareaBase, { id: 'ta2', tenantId: 't2', titulo: 'Reporte semanal', usuarioId: 'u2' }]);

    const cantidad = await service.avisarTareasQueVencenHoy();

    expect(cantidad).toBe(2);
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
  });
});
