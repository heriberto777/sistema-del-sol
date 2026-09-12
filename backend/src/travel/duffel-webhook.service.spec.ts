import { DuffelWebhookService } from './duffel-webhook.service';

describe('DuffelWebhookService', () => {
  let prisma: { travelReserva: { updateMany: jest.Mock } };
  let service: DuffelWebhookService;

  beforeEach(() => {
    prisma = { travelReserva: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    service = new DuffelWebhookService(prisma as never);
  });

  it('marca CAMBIO_ITINERARIO cuando llega order.airline_initiated_change_detected', async () => {
    await service.procesarEvento({ type: 'order.airline_initiated_change_detected', data: { order_id: 'ord_1' } });

    expect(prisma.travelReserva.updateMany).toHaveBeenCalledWith({
      where: { proveedorOrdenId: 'ord_1' },
      data: expect.objectContaining({ alertaProveedorTipo: 'CAMBIO_ITINERARIO' }),
    });
  });

  it('marca CANCELACION_EXTERNA cuando llega order_cancellation.created', async () => {
    await service.procesarEvento({ type: 'order_cancellation.created', data: { object: { order_id: 'ord_2' } } });

    expect(prisma.travelReserva.updateMany).toHaveBeenCalledWith({
      where: { proveedorOrdenId: 'ord_2' },
      data: expect.objectContaining({ alertaProveedorTipo: 'CANCELACION_EXTERNA' }),
    });
  });

  it('usa object_id como último recurso si no hay order_id en data', async () => {
    await service.procesarEvento({ type: 'order_cancellation.created', object_id: 'ord_3' });

    expect(prisma.travelReserva.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { proveedorOrdenId: 'ord_3' } }));
  });

  it('ignora un tipo de evento no manejado sin tocar la base', async () => {
    await service.procesarEvento({ type: 'order.updated', data: { order_id: 'ord_1' } });

    expect(prisma.travelReserva.updateMany).not.toHaveBeenCalled();
  });

  it('ignora un evento sin ningún id de orden reconocible', async () => {
    await service.procesarEvento({ type: 'order_cancellation.created', data: {} });

    expect(prisma.travelReserva.updateMany).not.toHaveBeenCalled();
  });
});
