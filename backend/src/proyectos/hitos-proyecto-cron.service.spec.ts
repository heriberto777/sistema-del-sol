import { HitosProyectoCronService } from './hitos-proyecto-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

describe('HitosProyectoCronService', () => {
  let service: HitosProyectoCronService;
  let prisma: { hitoProyecto: { findMany: jest.Mock; update: jest.Mock }; configuracion: { findUnique: jest.Mock } };
  let eventBus: jest.Mocked<EventBusService>;

  const hitoBase = {
    id: 'h1',
    tenantId: 't1',
    nombre: 'Entrega 1',
    proyectoId: 'p1',
    proyecto: { nombre: 'Proyecto X', responsable: { userId: 'u1' } },
  };

  beforeEach(() => {
    prisma = {
      hitoProyecto: { findMany: jest.fn(), update: jest.fn() },
      configuracion: { findUnique: jest.fn() },
    };
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new HitosProyectoCronService(prisma as unknown as PrismaService, eventBus);
  });

  it('un hito cuya fechaObjetivo entra en la ventana configurada del tenant emite el evento y marca la alerta como enviada', async () => {
    const fechaObjetivo = new Date();
    fechaObjetivo.setDate(fechaObjetivo.getDate() + 2); // dentro de 3 días (default)
    prisma.hitoProyecto.findMany.mockResolvedValue([{ ...hitoBase, fechaObjetivo }]);
    prisma.configuracion.findUnique.mockResolvedValue(null); // sin fila -> usa el default '3'

    const cantidad = await service.avisarHitosPorVencer();

    expect(cantidad).toBe(1);
    expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.HITO_PROYECTO_POR_VENCER, {
      tenantId: 't1',
      hitoId: 'h1',
      hitoNombre: 'Entrega 1',
      proyectoNombre: 'Proyecto X',
      fechaObjetivo: fechaObjetivo.toISOString(),
      responsableUserId: 'u1',
    });
    expect(prisma.hitoProyecto.update).toHaveBeenCalledWith({ where: { id: 'h1' }, data: { alertaVencimientoEnviada: true } });
  });

  it('un hito fuera de la ventana del tenant (fecha muy lejana) no emite nada ni marca la alerta', async () => {
    const fechaObjetivo = new Date();
    fechaObjetivo.setDate(fechaObjetivo.getDate() + 30);
    prisma.hitoProyecto.findMany.mockResolvedValue([{ ...hitoBase, fechaObjetivo }]);
    prisma.configuracion.findUnique.mockResolvedValue(null);

    const cantidad = await service.avisarHitosPorVencer();

    expect(cantidad).toBe(0);
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(prisma.hitoProyecto.update).not.toHaveBeenCalled();
  });

  it('usa el umbral configurado por el tenant (Configuracion) en vez del default', async () => {
    const fechaObjetivo = new Date();
    fechaObjetivo.setDate(fechaObjetivo.getDate() + 8); // fuera del default (3) pero dentro de un umbral de 10
    prisma.hitoProyecto.findMany.mockResolvedValue([{ ...hitoBase, fechaObjetivo }]);
    prisma.configuracion.findUnique.mockResolvedValue({ valor: '10' });

    const cantidad = await service.avisarHitosPorVencer();

    expect(prisma.configuracion.findUnique).toHaveBeenCalledWith({
      where: { tenantId_clave: { tenantId: 't1', clave: 'PROYECTOS_DIAS_ALERTA_HITO' } },
    });
    expect(cantidad).toBe(1);
    expect(eventBus.emit).toHaveBeenCalled();
  });

  it('responsableUserId es null si el proyecto no tiene responsable con usuario', async () => {
    const fechaObjetivo = new Date();
    prisma.hitoProyecto.findMany.mockResolvedValue([
      { ...hitoBase, fechaObjetivo, proyecto: { nombre: 'Proyecto X', responsable: null } },
    ]);
    prisma.configuracion.findUnique.mockResolvedValue(null);

    await service.avisarHitosPorVencer();

    expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.HITO_PROYECTO_POR_VENCER, expect.objectContaining({ responsableUserId: null }));
  });

  it('no hace nada si no hay hitos pendientes de avisar', async () => {
    prisma.hitoProyecto.findMany.mockResolvedValue([]);

    const cantidad = await service.avisarHitosPorVencer();

    expect(cantidad).toBe(0);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});
