import { TareasProyectoCronService } from './tareas-proyecto-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

describe('TareasProyectoCronService', () => {
  let service: TareasProyectoCronService;
  let prisma: { tareaProyecto: { findMany: jest.Mock; update: jest.Mock } };
  let eventBus: jest.Mocked<EventBusService>;

  const tareaBase = {
    id: 'tp1',
    tenantId: 't1',
    titulo: 'Entregar diseño',
    proyecto: { nombre: 'Proyecto X' },
    responsables: [{ empleado: { userId: 'u1' } }, { empleado: { userId: 'u2' } }],
  };

  beforeEach(() => {
    prisma = { tareaProyecto: { findMany: jest.fn(), update: jest.fn() } };
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new TareasProyectoCronService(prisma as unknown as PrismaService, eventBus);
  });

  it('emite el evento con TODOS los responsables con userId y marca recordatorioEnviado', async () => {
    prisma.tareaProyecto.findMany.mockResolvedValue([tareaBase]);

    const cantidad = await service.avisarTareasQueVencenHoy();

    expect(cantidad).toBe(1);
    expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.TAREA_PROYECTO_VENCE_HOY, {
      tenantId: 't1',
      tareaId: 'tp1',
      tareaTitulo: 'Entregar diseño',
      proyectoNombre: 'Proyecto X',
      destinatariosUserId: ['u1', 'u2'],
    });
    expect(prisma.tareaProyecto.update).toHaveBeenCalledWith({ where: { id: 'tp1' }, data: { recordatorioEnviado: true } });
  });

  it('filtra responsables sin userId (Empleado sin usuario del sistema vinculado)', async () => {
    prisma.tareaProyecto.findMany.mockResolvedValue([
      { ...tareaBase, responsables: [{ empleado: { userId: 'u1' } }, { empleado: { userId: null } }] },
    ]);

    await service.avisarTareasQueVencenHoy();

    expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.TAREA_PROYECTO_VENCE_HOY, expect.objectContaining({ destinatariosUserId: ['u1'] }));
  });

  it('sin responsables con userId, NO emite evento pero SÍ marca recordatorioEnviado (no reintenta cada día)', async () => {
    prisma.tareaProyecto.findMany.mockResolvedValue([{ ...tareaBase, responsables: [] }]);

    const cantidad = await service.avisarTareasQueVencenHoy();

    expect(cantidad).toBe(0);
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(prisma.tareaProyecto.update).toHaveBeenCalledWith({ where: { id: 'tp1' }, data: { recordatorioEnviado: true } });
  });

  it('no hace nada si no hay tareas que venzan hoy', async () => {
    prisma.tareaProyecto.findMany.mockResolvedValue([]);

    const cantidad = await service.avisarTareasQueVencenHoy();

    expect(cantidad).toBe(0);
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(prisma.tareaProyecto.update).not.toHaveBeenCalled();
  });
});
