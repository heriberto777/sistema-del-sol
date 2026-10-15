import { DuffelWebhookService } from './duffel-webhook.service';
import { cifrar } from '../common/utils/encriptado.util';

describe('DuffelWebhookService', () => {
  let prisma: { travelReserva: { updateMany: jest.Mock; findFirst: jest.Mock }; travelConfigTenant: { findUnique: jest.Mock } };
  let service: DuffelWebhookService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'clave-de-prueba';
    prisma = {
      travelReserva: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findFirst: jest.fn() },
      travelConfigTenant: { findUnique: jest.fn() },
    };
    service = new DuffelWebhookService(prisma as never);
  });

  describe('resolverTenantPorEvento', () => {
    it('devuelve null sin consultar la BD si el evento no trae ningún id de orden', async () => {
      const tenantId = await service.resolverTenantPorEvento({ type: 'order_cancellation.created', data: {} });
      expect(tenantId).toBeNull();
      expect(prisma.travelReserva.findFirst).not.toHaveBeenCalled();
    });

    it('resuelve el tenantId de la reserva que coincide con el id de orden', async () => {
      prisma.travelReserva.findFirst.mockResolvedValue({ tenantId: 't1' });

      const tenantId = await service.resolverTenantPorEvento({ type: 'order.airline_initiated_change_detected', data: { order_id: 'ord_1' } });

      expect(tenantId).toBe('t1');
      expect(prisma.travelReserva.findFirst).toHaveBeenCalledWith({ where: { proveedorOrdenId: 'ord_1' }, select: { tenantId: true } });
    });

    it('devuelve null si ninguna reserva coincide', async () => {
      prisma.travelReserva.findFirst.mockResolvedValue(null);
      const tenantId = await service.resolverTenantPorEvento({ type: 'order_cancellation.created', object_id: 'ord_x' });
      expect(tenantId).toBeNull();
    });
  });

  describe('obtenerSecretoWebhook', () => {
    it('devuelve null si el tenant no tiene webhook secret guardado', async () => {
      prisma.travelConfigTenant.findUnique.mockResolvedValue({ duffelWebhookSecretCifrado: null });
      expect(await service.obtenerSecretoWebhook('t1')).toBeNull();
    });

    it('devuelve null si el tenant no tiene ninguna fila de config', async () => {
      prisma.travelConfigTenant.findUnique.mockResolvedValue(null);
      expect(await service.obtenerSecretoWebhook('t1')).toBeNull();
    });

    it('descifra y devuelve el secreto guardado', async () => {
      prisma.travelConfigTenant.findUnique.mockResolvedValue({ duffelWebhookSecretCifrado: cifrar('whsec_real') });
      expect(await service.obtenerSecretoWebhook('t1')).toBe('whsec_real');
    });
  });

  describe('procesarEvento', () => {
    it('marca CAMBIO_ITINERARIO cuando llega order.airline_initiated_change_detected, scopeado al tenant', async () => {
      await service.procesarEvento({ type: 'order.airline_initiated_change_detected', data: { order_id: 'ord_1' } }, 't1');

      expect(prisma.travelReserva.updateMany).toHaveBeenCalledWith({
        where: { proveedorOrdenId: 'ord_1', tenantId: 't1' },
        data: expect.objectContaining({ alertaProveedorTipo: 'CAMBIO_ITINERARIO' }),
      });
    });

    it('marca CANCELACION_EXTERNA cuando llega order_cancellation.created', async () => {
      await service.procesarEvento({ type: 'order_cancellation.created', data: { object: { order_id: 'ord_2' } } }, 't1');

      expect(prisma.travelReserva.updateMany).toHaveBeenCalledWith({
        where: { proveedorOrdenId: 'ord_2', tenantId: 't1' },
        data: expect.objectContaining({ alertaProveedorTipo: 'CANCELACION_EXTERNA' }),
      });
    });

    it('usa object_id como último recurso si no hay order_id en data', async () => {
      await service.procesarEvento({ type: 'order_cancellation.created', object_id: 'ord_3' }, 't1');

      expect(prisma.travelReserva.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { proveedorOrdenId: 'ord_3', tenantId: 't1' } }));
    });

    it('ignora un tipo de evento no manejado sin tocar la base', async () => {
      await service.procesarEvento({ type: 'order.updated', data: { order_id: 'ord_1' } }, 't1');

      expect(prisma.travelReserva.updateMany).not.toHaveBeenCalled();
    });

    it('ignora un evento sin ningún id de orden reconocible', async () => {
      await service.procesarEvento({ type: 'order_cancellation.created', data: {} }, 't1');

      expect(prisma.travelReserva.updateMany).not.toHaveBeenCalled();
    });
  });
});
