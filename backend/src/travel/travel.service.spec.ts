import { BadRequestException } from '@nestjs/common';
import { TravelService } from './travel.service';
import { TravelRepository } from './travel.repository';
import { ClientesService } from '../clientes/clientes.service';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { TasasCambioService } from '../tasas-cambio/tasas-cambio.service';
import { TravelProviderService } from './providers/travel-provider.service';
import { TravelProvider } from './providers/travel-provider.interface';

describe('TravelService', () => {
  let service: TravelService;
  let repository: jest.Mocked<TravelRepository>;
  let clientesService: jest.Mocked<ClientesService>;
  let correlativosRepository: jest.Mocked<CorrelativosRepository>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let proveedor: jest.Mocked<TravelProvider>;
  let travelProviderService: jest.Mocked<TravelProviderService>;
  let tasasCambioService: jest.Mocked<TasasCambioService>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      marcarFacturada: jest.fn(),
      eliminar: jest.fn(),
      buscarBodegaActivaPorDefecto: jest.fn(),
      crearDesdeProveedor: jest.fn(),
      marcarCancelacionCotizada: jest.fn(),
      marcarCanceladaPorProveedor: jest.fn(),
      registrarMovimientoLedger: jest.fn(),
      listarLedger: jest.fn(),
      descartarAlertaProveedor: jest.fn(),
      resumen: jest.fn(),
    } as unknown as jest.Mocked<TravelRepository>;
    clientesService = { buscarPorId: jest.fn() } as unknown as jest.Mocked<ClientesService>;
    correlativosRepository = { siguiente: jest.fn() } as unknown as jest.Mocked<CorrelativosRepository>;
    facturacionService = { crear: jest.fn() } as unknown as jest.Mocked<FacturacionService>;
    proveedor = {
      clave: 'duffel',
      habilitado: true,
      buscarVuelos: jest.fn(),
      obtenerOferta: jest.fn(),
      crearOrdenVuelo: jest.fn(),
      cotizarCancelacion: jest.fn(),
      confirmarCancelacion: jest.fn(),
    } as unknown as jest.Mocked<TravelProvider>;
    travelProviderService = { activo: proveedor } as unknown as jest.Mocked<TravelProviderService>;
    tasasCambioService = { buscarPorMoneda: jest.fn() } as unknown as jest.Mocked<TasasCambioService>;
    service = new TravelService(repository, clientesService, correlativosRepository, facturacionService, travelProviderService, tasasCambioService);
  });

  describe('crear', () => {
    it('rechaza si el cliente no pertenece al tenant (404 vía ClientesService)', async () => {
      clientesService.buscarPorId.mockRejectedValue(new Error('no encontrado'));
      await expect(
        service.crear({ clienteId: 'c1', tipo: 'VUELO', montoCosto: 100, montoVenta: 130 } as never, 't1'),
      ).rejects.toThrow('no encontrado');
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('arma el código interno con el año actual y el correlativo, y crea la reserva', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'c1' } as never);
      correlativosRepository.siguiente.mockResolvedValue('000001');
      await service.crear({ clienteId: 'c1', tipo: 'VUELO', montoCosto: 100, montoVenta: 130, pasajeros: [] } as never, 't1');

      const anio = new Date().getFullYear();
      expect(correlativosRepository.siguiente).toHaveBeenCalledWith('t1', 'TRAVEL_RESERVA');
      expect(repository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', codigoInterno: `TRV-${anio}-000001`, clienteId: 'c1', montoCosto: 100, montoVenta: 130 }),
        [],
      );
    });
  });

  describe('listar/buscarPorId', () => {
    it('delegan al repositorio', async () => {
      await service.listar();
      expect(repository.listar).toHaveBeenCalled();

      await service.buscarPorId('r1');
      expect(repository.buscarPorId).toHaveBeenCalledWith('r1');
    });
  });

  describe('actualizar', () => {
    it('si viene clienteId, valida que pertenezca al tenant antes de actualizar', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'c2' } as never);
      await service.actualizar('r1', { clienteId: 'c2' });
      expect(clientesService.buscarPorId).toHaveBeenCalledWith('c2');
      expect(repository.actualizar).toHaveBeenCalledWith('r1', { clienteId: 'c2' });
    });

    it('si no viene clienteId, no valida nada y solo actualiza', async () => {
      await service.actualizar('r1', { notas: 'algo' });
      expect(clientesService.buscarPorId).not.toHaveBeenCalled();
      expect(repository.actualizar).toHaveBeenCalledWith('r1', { notas: 'algo' });
    });
  });

  describe('eliminar', () => {
    it('rechaza si la reserva ya fue facturada', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'r1', estado: 'FACTURADA' } as never);
      await expect(service.eliminar('r1')).rejects.toThrow(BadRequestException);
      expect(repository.eliminar).not.toHaveBeenCalled();
    });

    it('elimina si no está facturada', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'r1', estado: 'PENDIENTE' } as never);
      await service.eliminar('r1');
      expect(repository.eliminar).toHaveBeenCalledWith('r1');
    });
  });

  describe('facturar', () => {
    const reservaBase = {
      id: 'r1',
      clienteId: 'c1',
      tipo: 'VUELO',
      estado: 'CONFIRMADA',
      moneda: 'DOP',
      montoVenta: 5000,
      codigoInterno: 'TRV-2026-000001',
      facturaId: null,
    };

    it('rechaza si ya fue facturada', async () => {
      repository.buscarPorId.mockResolvedValue({ ...reservaBase, facturaId: 'f1' } as never);
      await expect(service.facturar('r1', 't1', 'u1')).rejects.toThrow('Esta reserva ya fue facturada');
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });

    it('rechaza si está cancelada', async () => {
      repository.buscarPorId.mockResolvedValue({ ...reservaBase, estado: 'CANCELADA' } as never);
      await expect(service.facturar('r1', 't1', 'u1')).rejects.toThrow('cancelada');
    });

    it('rechaza con un mensaje claro si la moneda no es DOP y no hay tasa de cambio configurada', async () => {
      repository.buscarPorId.mockResolvedValue({ ...reservaBase, moneda: 'USD' } as never);
      tasasCambioService.buscarPorMoneda.mockResolvedValue(null);
      await expect(service.facturar('r1', 't1', 'u1')).rejects.toThrow('USD');
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });

    it('rechaza si el tenant no tiene bodega activa', async () => {
      repository.buscarPorId.mockResolvedValue(reservaBase as never);
      repository.buscarBodegaActivaPorDefecto.mockResolvedValue(null);
      await expect(service.facturar('r1', 't1', 'u1')).rejects.toThrow('bodega activa');
    });

    it('factura con descripcionManual y sinMovimientoInventario, y marca la reserva como FACTURADA', async () => {
      repository.buscarPorId.mockResolvedValue(reservaBase as never);
      repository.buscarBodegaActivaPorDefecto.mockResolvedValue({ id: 'b1' } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1', numero: '000010', total: 5000 } as never);

      const resultado = await service.facturar('r1', 't1', 'u1');

      expect(facturacionService.crear).toHaveBeenCalledWith(
        {
          clienteId: 'c1',
          bodegaId: 'b1',
          tipoFactura: 'CONTADO',
          moneda: undefined,
          lineas: [{ descripcionManual: 'Boleto aéreo — TRV-2026-000001', cantidad: 1, precioUnitario: 5000, aplicaItbis: true }],
        },
        't1',
        'u1',
        { sinMovimientoInventario: true },
      );
      expect(repository.marcarFacturada).toHaveBeenCalledWith('r1', 'f1');
      expect(resultado).toEqual({ facturaId: 'f1', numero: '000010', total: 5000 });
    });

    it('convierte a DOP con la tasa configurada del tenant y pasa la moneda original a Facturación (multi-moneda)', async () => {
      repository.buscarPorId.mockResolvedValue({ ...reservaBase, moneda: 'USD', montoVenta: 320 } as never);
      tasasCambioService.buscarPorMoneda.mockResolvedValue({ tasa: 58.5 } as never);
      repository.buscarBodegaActivaPorDefecto.mockResolvedValue({ id: 'b1' } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1', numero: '000011', total: 18720 } as never);

      await service.facturar('r1', 't1', 'u1');

      expect(tasasCambioService.buscarPorMoneda).toHaveBeenCalledWith('USD');
      expect(facturacionService.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          moneda: 'USD',
          lineas: [expect.objectContaining({ precioUnitario: 18720 })],
        }),
        't1',
        'u1',
        { sinMovimientoInventario: true },
      );
    });
  });

  describe('buscarVuelos', () => {
    it('delega en el proveedor activo', async () => {
      proveedor.buscarVuelos.mockResolvedValue({ solicitudId: 'orq_1', ofertas: [] });
      const dto = { tramos: [{ origen: 'SDQ', destino: 'MAD', fecha: '2026-12-10' }], pasajeros: [{ tipo: 'adult' as const }] };
      await service.buscarVuelos(dto);
      expect(proveedor.buscarVuelos).toHaveBeenCalledWith(dto);
    });
  });

  describe('reservarOfertaVuelo', () => {
    const dto = {
      clienteId: 'c1',
      ofertaId: 'off_1',
      pasajeros: [{ id: 'pas_1', nombre: 'Juan', apellido: 'Pérez', fechaNacimiento: '1990-01-01', genero: 'm' as const, titulo: 'mr', email: 'j@x.com', telefono: '+1809' }],
      montoVenta: 500,
    };

    it('rechaza si el cliente no pertenece al tenant', async () => {
      clientesService.buscarPorId.mockRejectedValue(new Error('no encontrado'));
      await expect(service.reservarOfertaVuelo(dto, 't1')).rejects.toThrow('no encontrado');
      expect(proveedor.obtenerOferta).not.toHaveBeenCalled();
    });

    it('rechaza si la oferta ya expiró (re-price la detecta)', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'c1' } as never);
      proveedor.obtenerOferta.mockResolvedValue({ id: 'off_1', aerolinea: 'X', montoTotal: '450.00', moneda: 'USD', expiraEn: '2000-01-01T00:00:00Z', tramosCrudo: null, pasajeros: [] });

      await expect(service.reservarOfertaVuelo(dto, 't1')).rejects.toThrow(BadRequestException);
      expect(proveedor.crearOrdenVuelo).not.toHaveBeenCalled();
    });

    it('re-precia, crea la orden con Balance, guarda la reserva y debita el ledger', async () => {
      clientesService.buscarPorId.mockResolvedValue({ id: 'c1' } as never);
      const expiraEn = new Date(Date.now() + 3600_000).toISOString();
      proveedor.obtenerOferta.mockResolvedValue({ id: 'off_1', aerolinea: 'Iberia', montoTotal: '450.00', moneda: 'USD', expiraEn, tramosCrudo: null, pasajeros: [] });
      proveedor.crearOrdenVuelo.mockResolvedValue({ id: 'ord_1', localizador: 'ABC123', montoTotal: '450.00', moneda: 'USD' });
      correlativosRepository.siguiente.mockResolvedValue('000001');
      repository.crearDesdeProveedor.mockResolvedValue({ id: 'r1', codigoInterno: `TRV-${new Date().getFullYear()}-000001` } as never);

      const reserva = await service.reservarOfertaVuelo(dto, 't1');

      expect(proveedor.crearOrdenVuelo).toHaveBeenCalledWith({ ofertaId: 'off_1', pasajeros: dto.pasajeros, montoBalance: 450, monedaBalance: 'USD' });
      expect(repository.crearDesdeProveedor).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          clienteId: 'c1',
          moneda: 'USD',
          montoCosto: 450,
          montoVenta: 500,
          proveedor: 'duffel',
          proveedorOfertaId: 'off_1',
          proveedorOrdenId: 'ord_1',
          localizadorAerolinea: 'ABC123',
        }),
        dto.pasajeros,
      );
      expect(repository.registrarMovimientoLedger).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', reservaId: 'r1', tipo: 'DEBITO', monto: 450, moneda: 'USD' }),
      );
      expect(reserva).toEqual({ id: 'r1', codigoInterno: expect.any(String) });
    });
  });

  describe('cotizarCancelacionProveedor', () => {
    it('rechaza si la reserva no tiene una orden de proveedor (es carga manual)', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'r1', proveedorOrdenId: null } as never);
      await expect(service.cotizarCancelacionProveedor('r1')).rejects.toThrow(BadRequestException);
      expect(proveedor.cotizarCancelacion).not.toHaveBeenCalled();
    });

    it('cotiza contra el proveedor y guarda el id de cancelación', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'r1', proveedorOrdenId: 'ord_1' } as never);
      proveedor.cotizarCancelacion.mockResolvedValue({ id: 'orc_1', montoReembolso: '300.00', moneda: 'USD' });

      const resultado = await service.cotizarCancelacionProveedor('r1');

      expect(proveedor.cotizarCancelacion).toHaveBeenCalledWith('ord_1');
      expect(repository.marcarCancelacionCotizada).toHaveBeenCalledWith('r1', 'orc_1');
      expect(resultado).toEqual({ id: 'orc_1', montoReembolso: '300.00', moneda: 'USD' });
    });
  });

  describe('confirmarCancelacionProveedor', () => {
    it('rechaza si todavía no se cotizó la cancelación', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'r1', proveedorCancelacionId: null } as never);
      await expect(service.confirmarCancelacionProveedor('r1', 't1')).rejects.toThrow(BadRequestException);
      expect(proveedor.confirmarCancelacion).not.toHaveBeenCalled();
    });

    it('confirma, marca CANCELADA y acredita el reembolso al ledger', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'r1', proveedorCancelacionId: 'orc_1', codigoInterno: 'TRV-2026-000001', moneda: 'USD' } as never);
      proveedor.confirmarCancelacion.mockResolvedValue({ reembolsado: true, montoReembolso: '300.00', moneda: 'USD' });

      await service.confirmarCancelacionProveedor('r1', 't1');

      expect(repository.marcarCanceladaPorProveedor).toHaveBeenCalledWith('r1');
      expect(repository.registrarMovimientoLedger).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', reservaId: 'r1', tipo: 'CREDITO', monto: 300, moneda: 'USD' }),
      );
    });

    it('no acredita nada si el proveedor no reembolsó (tarifa no reembolsable)', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'r1', proveedorCancelacionId: 'orc_1', codigoInterno: 'TRV-2026-000001', moneda: 'USD' } as never);
      proveedor.confirmarCancelacion.mockResolvedValue({ reembolsado: false, montoReembolso: null, moneda: null });

      await service.confirmarCancelacionProveedor('r1', 't1');

      expect(repository.registrarMovimientoLedger).not.toHaveBeenCalled();
    });
  });

  describe('saldoLedger', () => {
    it('suma CREDITO - DEBITO agrupado por moneda', async () => {
      repository.listarLedger.mockResolvedValue([
        { tipo: 'DEBITO', monto: 450, moneda: 'USD' },
        { tipo: 'CREDITO', monto: 100, moneda: 'USD' },
        { tipo: 'DEBITO', monto: 200, moneda: 'DOP' },
      ] as never);

      const saldos = await service.saldoLedger();

      expect(saldos).toEqual(expect.arrayContaining([{ moneda: 'USD', saldo: -350 }, { moneda: 'DOP', saldo: -200 }]));
    });
  });

  describe('descartarAlertaProveedor', () => {
    it('delega al repositorio', async () => {
      await service.descartarAlertaProveedor('r1');
      expect(repository.descartarAlertaProveedor).toHaveBeenCalledWith('r1');
    });
  });

  describe('resumen', () => {
    it('combina el resumen del repositorio con el saldo del ledger', async () => {
      repository.resumen.mockResolvedValue({ reservasPorEstado: { CONFIRMADA: 2 }, ingresosMes: 500, pendientesDeFacturar: 2 } as never);
      repository.listarLedger.mockResolvedValue([{ tipo: 'DEBITO', monto: 450, moneda: 'USD' }] as never);

      const resultado = await service.resumen();

      expect(resultado).toEqual({
        reservasPorEstado: { CONFIRMADA: 2 },
        ingresosMes: 500,
        pendientesDeFacturar: 2,
        saldoLedger: [{ moneda: 'USD', saldo: -450 }],
      });
    });
  });
});
