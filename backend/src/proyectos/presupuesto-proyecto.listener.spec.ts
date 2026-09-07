import { PresupuestoProyectoListener } from './presupuesto-proyecto.listener';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

describe('PresupuestoProyectoListener', () => {
  let service: PresupuestoProyectoListener;
  let prisma: {
    proyecto: { findUnique: jest.Mock; update: jest.Mock };
    registroHoraProyecto: { groupBy: jest.Mock };
    configuracion: { findUnique: jest.Mock };
    empleado: { findUnique: jest.Mock };
    gastoMenor: { findUnique: jest.Mock; aggregate: jest.Mock };
  };
  let eventBus: jest.Mocked<EventBusService>;

  const proyectoBase = {
    id: 'p1',
    nombre: 'Proyecto X',
    presupuesto: '10000',
    alertaPresupuestoEnviada: false,
    responsable: { userId: 'u1' },
  };

  beforeEach(() => {
    prisma = {
      proyecto: { findUnique: jest.fn(), update: jest.fn() },
      registroHoraProyecto: { groupBy: jest.fn() },
      configuracion: { findUnique: jest.fn() },
      empleado: { findUnique: jest.fn() },
      gastoMenor: { findUnique: jest.fn(), aggregate: jest.fn() },
    };
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new PresupuestoProyectoListener(prisma as unknown as PrismaService, eventBus);
  });

  describe('verificarPresupuesto (vía alRegistrarHoras)', () => {
    it('proyecto sin presupuesto no hace nada', async () => {
      prisma.proyecto.findUnique.mockResolvedValue({ ...proyectoBase, presupuesto: null });

      await service.alRegistrarHoras({ tenantId: 't1', proyectoId: 'p1' });

      expect(prisma.registroHoraProyecto.groupBy).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('proyecto ya alertado no vuelve a calcular ni a emitir', async () => {
      prisma.proyecto.findUnique.mockResolvedValue({ ...proyectoBase, alertaPresupuestoEnviada: true });

      await service.alRegistrarHoras({ tenantId: 't1', proyectoId: 'p1' });

      expect(prisma.registroHoraProyecto.groupBy).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('costo total por debajo del presupuesto no emite nada', async () => {
      prisma.proyecto.findUnique.mockResolvedValue(proyectoBase);
      prisma.registroHoraProyecto.groupBy.mockResolvedValue([{ empleadoId: 'e1', _sum: { horas: 10 } }]);
      prisma.configuracion.findUnique.mockResolvedValue(null); // usa default 173.33
      prisma.empleado.findUnique.mockResolvedValue({ id: 'e1', salarioBrutoMensual: '17333' }); // costoHora ~= 100
      prisma.gastoMenor.aggregate.mockResolvedValue({ _sum: { total: 500 } });

      await service.alRegistrarHoras({ tenantId: 't1', proyectoId: 'p1' });
      // costoHoras ~1000 + costoGastos 500 = 1500 <= 10000

      expect(eventBus.emit).not.toHaveBeenCalled();
      expect(prisma.proyecto.update).not.toHaveBeenCalled();
    });

    it('costo total por encima del presupuesto emite PROYECTO_PRESUPUESTO_SUPERADO y marca la alerta', async () => {
      prisma.proyecto.findUnique.mockResolvedValue(proyectoBase);
      prisma.registroHoraProyecto.groupBy.mockResolvedValue([{ empleadoId: 'e1', _sum: { horas: 100 } }]);
      prisma.configuracion.findUnique.mockResolvedValue(null);
      prisma.empleado.findUnique.mockResolvedValue({ id: 'e1', salarioBrutoMensual: '17333' }); // costoHora ~= 100 x 100h = 10000
      prisma.gastoMenor.aggregate.mockResolvedValue({ _sum: { total: 5000 } });

      await service.alRegistrarHoras({ tenantId: 't1', proyectoId: 'p1' });
      // costoTotal ~15000 > 10000

      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.PROYECTO_PRESUPUESTO_SUPERADO,
        expect.objectContaining({ tenantId: 't1', proyectoId: 'p1', proyectoNombre: 'Proyecto X', presupuesto: '10000', responsableUserId: 'u1' }),
      );
      expect(prisma.proyecto.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { alertaPresupuestoEnviada: true } });
    });

    it('sin horas registradas, solo cuenta el costo de gastos', async () => {
      prisma.proyecto.findUnique.mockResolvedValue(proyectoBase);
      prisma.registroHoraProyecto.groupBy.mockResolvedValue([]);
      prisma.gastoMenor.aggregate.mockResolvedValue({ _sum: { total: 12000 } });

      await service.alRegistrarHoras({ tenantId: 't1', proyectoId: 'p1' });

      expect(prisma.configuracion.findUnique).not.toHaveBeenCalled(); // no hace falta leer la config si no hay horas
      expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.PROYECTO_PRESUPUESTO_SUPERADO, expect.objectContaining({ costoTotal: '12000' }));
    });
  });

  describe('alCrearGastoMenor', () => {
    it('gasto sin proyectoId no hace nada', async () => {
      prisma.gastoMenor.findUnique.mockResolvedValue({ id: 'g1', proyectoId: null });

      await service.alCrearGastoMenor({ tenantId: 't1', gastoMenorId: 'g1' });

      expect(prisma.proyecto.findUnique).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('gasto con proyectoId dispara la verificación de presupuesto de ese proyecto', async () => {
      prisma.gastoMenor.findUnique.mockResolvedValue({ id: 'g1', proyectoId: 'p1' });
      prisma.proyecto.findUnique.mockResolvedValue({ ...proyectoBase, presupuesto: null }); // corta temprano, solo verificamos que llega a buscar el proyecto

      await service.alCrearGastoMenor({ tenantId: 't1', gastoMenorId: 'g1' });

      expect(prisma.proyecto.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' }, include: { responsable: true } });
    });
  });
});
