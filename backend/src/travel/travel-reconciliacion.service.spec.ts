import { TravelReconciliacionService } from './travel-reconciliacion.service';
import { TravelProviderService } from './providers/travel-provider.service';
import { TravelProvider } from './providers/travel-provider.interface';
import { TravelConfigService } from '../travel-config/travel-config.service';

const CREDENCIALES = { token: 'duffel_test_real' };

describe('TravelReconciliacionService', () => {
  let service: TravelReconciliacionService;
  let prisma: { travelReserva: { findFirst: jest.Mock } };
  let proveedor: jest.Mocked<Pick<TravelProvider, 'listarOrdenes'>>;
  let travelProviderService: jest.Mocked<TravelProviderService>;
  let travelConfigService: jest.Mocked<TravelConfigService>;

  beforeEach(() => {
    prisma = { travelReserva: { findFirst: jest.fn() } };
    proveedor = { listarOrdenes: jest.fn() };
    travelProviderService = { activo: proveedor } as unknown as jest.Mocked<TravelProviderService>;
    travelConfigService = { obtenerCredencialesDuffel: jest.fn().mockResolvedValue(CREDENCIALES) } as unknown as jest.Mocked<TravelConfigService>;
    service = new TravelReconciliacionService(prisma as never, travelProviderService, travelConfigService);
  });

  it('rechaza (propaga el 503) si el tenant no configuró su cuenta de Duffel', async () => {
    travelConfigService.obtenerCredencialesDuffel.mockRejectedValue(new Error('no configurado'));
    await expect(service.reconciliar('t1')).rejects.toThrow('no configurado');
    expect(proveedor.listarOrdenes).not.toHaveBeenCalled();
  });

  it('usa las credenciales del tenant y reporta sin huérfanas ni cancelaciones cuando todo coincide', async () => {
    proveedor.listarOrdenes.mockResolvedValue({
      ordenes: [{ id: 'ord_1', localizador: 'ABC123', montoTotal: '450.00', moneda: 'USD', creadaEn: '2026-01-01T00:00:00Z', canceladaEn: null }],
      cursorSiguiente: null,
    });
    prisma.travelReserva.findFirst.mockResolvedValue({ id: 'r1', codigoInterno: 'TRV-2026-000001', estado: 'CONFIRMADA' });

    const resultado = await service.reconciliar('t1');

    expect(travelConfigService.obtenerCredencialesDuffel).toHaveBeenCalledWith('t1');
    expect(proveedor.listarOrdenes).toHaveBeenCalledWith(CREDENCIALES, undefined);
    expect(prisma.travelReserva.findFirst).toHaveBeenCalledWith({ where: { tenantId: 't1', proveedorOrdenId: 'ord_1' } });
    expect(resultado).toEqual({ totalOrdenesRevisadas: 1, ordenesHuerfanas: [], cancelacionesNoReflejadas: [] });
  });

  it('detecta una orden huérfana (existe en Duffel, sin reserva interna de este tenant)', async () => {
    proveedor.listarOrdenes.mockResolvedValue({
      ordenes: [{ id: 'ord_huerfana', localizador: 'XYZ999', montoTotal: '100.00', moneda: 'USD', creadaEn: '2026-01-01T00:00:00Z', canceladaEn: null }],
      cursorSiguiente: null,
    });
    prisma.travelReserva.findFirst.mockResolvedValue(null);

    const resultado = await service.reconciliar('t1');

    expect(resultado.ordenesHuerfanas).toEqual([{ id: 'ord_huerfana', localizador: 'XYZ999', montoTotal: '100.00', moneda: 'USD', creadaEn: '2026-01-01T00:00:00Z', canceladaEn: null }]);
  });

  it('detecta una cancelación no reflejada (Duffel la marca cancelada, la reserva interna no)', async () => {
    proveedor.listarOrdenes.mockResolvedValue({
      ordenes: [{ id: 'ord_1', localizador: 'ABC123', montoTotal: '450.00', moneda: 'USD', creadaEn: '2026-01-01T00:00:00Z', canceladaEn: '2026-01-05T00:00:00Z' }],
      cursorSiguiente: null,
    });
    prisma.travelReserva.findFirst.mockResolvedValue({ id: 'r1', codigoInterno: 'TRV-2026-000001', estado: 'CONFIRMADA' });

    const resultado = await service.reconciliar('t1');

    expect(resultado.cancelacionesNoReflejadas).toEqual([{ ordenId: 'ord_1', reservaId: 'r1', codigoInterno: 'TRV-2026-000001', canceladaEn: '2026-01-05T00:00:00Z' }]);
  });

  it('pagina hasta encontrar cursorSiguiente null', async () => {
    proveedor.listarOrdenes
      .mockResolvedValueOnce({ ordenes: [{ id: 'ord_1', localizador: 'A', montoTotal: '1', moneda: 'USD', creadaEn: '2026-01-01', canceladaEn: null }], cursorSiguiente: 'cursor_2' })
      .mockResolvedValueOnce({ ordenes: [{ id: 'ord_2', localizador: 'B', montoTotal: '2', moneda: 'USD', creadaEn: '2026-01-02', canceladaEn: null }], cursorSiguiente: null });
    prisma.travelReserva.findFirst.mockResolvedValue({ id: 'r1', codigoInterno: 'TRV-2026-000001', estado: 'CONFIRMADA' });

    const resultado = await service.reconciliar('t1');

    expect(resultado.totalOrdenesRevisadas).toBe(2);
    expect(proveedor.listarOrdenes).toHaveBeenNthCalledWith(2, CREDENCIALES, 'cursor_2');
  });

  it('para de paginar al llegar al tope de páginas (PAGINAS_MAX)', async () => {
    proveedor.listarOrdenes.mockResolvedValue({
      ordenes: [{ id: 'ord_x', localizador: 'X', montoTotal: '1', moneda: 'USD', creadaEn: '2026-01-01', canceladaEn: null }],
      cursorSiguiente: 'siempre_hay_mas',
    });
    prisma.travelReserva.findFirst.mockResolvedValue({ id: 'r1', codigoInterno: 'TRV-2026-000001', estado: 'CONFIRMADA' });

    await service.reconciliar('t1');

    expect(proveedor.listarOrdenes).toHaveBeenCalledTimes(10);
  });
});
