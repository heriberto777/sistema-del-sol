import { ActividadesCrmCronService } from './actividades-crm-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

describe('ActividadesCrmCronService', () => {
  let service: ActividadesCrmCronService;
  let prisma: { actividadCrm: { findMany: jest.Mock; update: jest.Mock } };
  let eventBus: jest.Mocked<EventBusService>;

  const actividadBase = { id: 'act1', tenantId: 't1', descripcion: 'Llamar para seguimiento', usuarioId: 'u1' };

  beforeEach(() => {
    prisma = { actividadCrm: { findMany: jest.fn(), update: jest.fn() } };
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new ActividadesCrmCronService(prisma as unknown as PrismaService, eventBus);
  });

  it('emite el evento y marca avisoEnviado para cada actividad que vence hoy', async () => {
    prisma.actividadCrm.findMany.mockResolvedValue([actividadBase]);

    const cantidad = await service.avisarActividadesQueVencenHoy();

    expect(cantidad).toBe(1);
    expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.CRM_ACTIVIDAD_VENCE_HOY, {
      tenantId: 't1',
      actividadId: 'act1',
      descripcion: 'Llamar para seguimiento',
      usuarioId: 'u1',
    });
    expect(prisma.actividadCrm.update).toHaveBeenCalledWith({ where: { id: 'act1' }, data: { avisoEnviado: true } });
  });

  it('la query excluye completadas/con avisoEnviado (delegado en el where de Prisma)', async () => {
    prisma.actividadCrm.findMany.mockResolvedValue([]);

    await service.avisarActividadesQueVencenHoy();

    const where = prisma.actividadCrm.findMany.mock.calls[0][0].where;
    expect(where.completada).toBe(false);
    expect(where.avisoEnviado).toBe(false);
    expect(where.fechaProgramada.gte).toBeInstanceOf(Date);
    expect(where.fechaProgramada.lt).toBeInstanceOf(Date);
  });

  it('no hace nada si no hay actividades que venzan hoy', async () => {
    prisma.actividadCrm.findMany.mockResolvedValue([]);

    const cantidad = await service.avisarActividadesQueVencenHoy();

    expect(cantidad).toBe(0);
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(prisma.actividadCrm.update).not.toHaveBeenCalled();
  });

  it('avisa varias actividades de distintos usuarios/tenants en la misma corrida', async () => {
    prisma.actividadCrm.findMany.mockResolvedValue([actividadBase, { id: 'act2', tenantId: 't2', descripcion: 'Enviar propuesta', usuarioId: 'u2' }]);

    const cantidad = await service.avisarActividadesQueVencenHoy();

    expect(cantidad).toBe(2);
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
  });
});
