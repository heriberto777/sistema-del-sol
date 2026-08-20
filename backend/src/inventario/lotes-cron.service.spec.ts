import { LotesCronService } from './lotes-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

describe('LotesCronService (Fase 5b)', () => {
  let service: LotesCronService;
  let prisma: { lote: { findMany: jest.Mock } };
  let eventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    prisma = { lote: { findMany: jest.fn() } };
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new LotesCronService(prisma as unknown as PrismaService, eventBus);
  });

  it('emite LOTE_POR_VENCER una vez por cada lote con saldo próximo a vencer, cruzando todos los tenants con el PrismaService global', async () => {
    prisma.lote.findMany.mockResolvedValue([
      {
        id: 'lote-1',
        tenantId: 't1',
        numeroLote: 'L1',
        fechaVencimiento: new Date('2026-09-01'),
        cantidadActual: 5,
        variante: { producto: { nombre: 'Yogurt' } },
      },
    ]);

    const cantidad = await service.avisarLotesPorVencer();

    expect(prisma.lote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cantidadActual: { gt: 0 } }) }),
    );
    expect(cantidad).toBe(1);
    expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.LOTE_POR_VENCER, {
      tenantId: 't1',
      loteId: 'lote-1',
      productoNombre: 'Yogurt',
      numeroLote: 'L1',
      fechaVencimiento: new Date('2026-09-01').toISOString(),
      cantidadActual: '5',
    });
  });

  it('no emite nada si no hay lotes por vencer', async () => {
    prisma.lote.findMany.mockResolvedValue([]);

    await service.avisarLotesPorVencer();

    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});
