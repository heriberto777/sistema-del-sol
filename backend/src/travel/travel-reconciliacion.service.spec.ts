import { TravelReconciliacionService } from './travel-reconciliacion.service';
import { TravelProvider } from './providers/travel-provider.interface';

describe('TravelReconciliacionService', () => {
  let prisma: { travelReserva: { findFirst: jest.Mock } };
  let proveedor: jest.Mocked<Pick<TravelProvider, 'listarOrdenes'>>;
  let travelProviderService: { activo: unknown };
  let service: TravelReconciliacionService;

  beforeEach(() => {
    prisma = { travelReserva: { findFirst: jest.fn() } };
    proveedor = { listarOrdenes: jest.fn() };
    travelProviderService = { activo: proveedor };
    service = new TravelReconciliacionService(prisma as never, travelProviderService as never);
  });

  it('marca como huérfana una orden de Duffel sin ninguna TravelReserva asociada', async () => {
    proveedor.listarOrdenes.mockResolvedValue({
      ordenes: [{ id: 'ord_1', localizador: 'ABC', montoTotal: '100', moneda: 'USD', creadaEn: '2026-01-01', canceladaEn: null }],
      cursorSiguiente: null,
    });
    prisma.travelReserva.findFirst.mockResolvedValue(null);

    const resultado = await service.reconciliar();

    expect(resultado.ordenesHuerfanas).toHaveLength(1);
    expect(resultado.ordenesHuerfanas[0].id).toBe('ord_1');
    expect(resultado.cancelacionesNoReflejadas).toHaveLength(0);
    expect(resultado.totalOrdenesRevisadas).toBe(1);
  });

  it('marca como cancelación no reflejada si Duffel dice cancelada pero la reserva interna no lo está', async () => {
    proveedor.listarOrdenes.mockResolvedValue({
      ordenes: [{ id: 'ord_1', localizador: 'ABC', montoTotal: '100', moneda: 'USD', creadaEn: '2026-01-01', canceladaEn: '2026-01-05' }],
      cursorSiguiente: null,
    });
    prisma.travelReserva.findFirst.mockResolvedValue({ id: 'r1', tenantId: 't1', codigoInterno: 'TRV-2026-000001', estado: 'CONFIRMADA' });

    const resultado = await service.reconciliar();

    expect(resultado.ordenesHuerfanas).toHaveLength(0);
    expect(resultado.cancelacionesNoReflejadas).toEqual([{ ordenId: 'ord_1', reservaId: 'r1', tenantId: 't1', codigoInterno: 'TRV-2026-000001', canceladaEn: '2026-01-05' }]);
  });

  it('no marca nada si la reserva interna ya está CANCELADA', async () => {
    proveedor.listarOrdenes.mockResolvedValue({
      ordenes: [{ id: 'ord_1', localizador: 'ABC', montoTotal: '100', moneda: 'USD', creadaEn: '2026-01-01', canceladaEn: '2026-01-05' }],
      cursorSiguiente: null,
    });
    prisma.travelReserva.findFirst.mockResolvedValue({ id: 'r1', tenantId: 't1', codigoInterno: 'TRV-2026-000001', estado: 'CANCELADA' });

    const resultado = await service.reconciliar();

    expect(resultado.cancelacionesNoReflejadas).toHaveLength(0);
  });

  it('sigue paginando mientras haya cursorSiguiente, hasta un máximo de páginas', async () => {
    proveedor.listarOrdenes
      .mockResolvedValueOnce({ ordenes: [{ id: 'ord_1', localizador: 'A', montoTotal: '1', moneda: 'USD', creadaEn: '', canceladaEn: null }], cursorSiguiente: 'p2' })
      .mockResolvedValueOnce({ ordenes: [{ id: 'ord_2', localizador: 'B', montoTotal: '1', moneda: 'USD', creadaEn: '', canceladaEn: null }], cursorSiguiente: null });
    prisma.travelReserva.findFirst.mockResolvedValue(null);

    const resultado = await service.reconciliar();

    expect(proveedor.listarOrdenes).toHaveBeenCalledTimes(2);
    expect(proveedor.listarOrdenes).toHaveBeenNthCalledWith(2, 'p2');
    expect(resultado.totalOrdenesRevisadas).toBe(2);
  });
});
