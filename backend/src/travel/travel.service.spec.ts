import { BadRequestException } from '@nestjs/common';
import { TravelService } from './travel.service';
import { TravelRepository } from './travel.repository';
import { ClientesService } from '../clientes/clientes.service';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';
import { FacturacionService } from '../facturacion/facturacion.service';

describe('TravelService', () => {
  let service: TravelService;
  let repository: jest.Mocked<TravelRepository>;
  let clientesService: jest.Mocked<ClientesService>;
  let correlativosRepository: jest.Mocked<CorrelativosRepository>;
  let facturacionService: jest.Mocked<FacturacionService>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      marcarFacturada: jest.fn(),
      eliminar: jest.fn(),
      buscarBodegaActivaPorDefecto: jest.fn(),
    } as unknown as jest.Mocked<TravelRepository>;
    clientesService = { buscarPorId: jest.fn() } as unknown as jest.Mocked<ClientesService>;
    correlativosRepository = { siguiente: jest.fn() } as unknown as jest.Mocked<CorrelativosRepository>;
    facturacionService = { crear: jest.fn() } as unknown as jest.Mocked<FacturacionService>;
    service = new TravelService(repository, clientesService, correlativosRepository, facturacionService);
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

    it('rechaza si la moneda no es DOP (conversión todavía no existe)', async () => {
      repository.buscarPorId.mockResolvedValue({ ...reservaBase, moneda: 'USD' } as never);
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
          lineas: [{ descripcionManual: 'Boleto aéreo — TRV-2026-000001', cantidad: 1, precioUnitario: 5000, aplicaItbis: true }],
        },
        't1',
        'u1',
        { sinMovimientoInventario: true },
      );
      expect(repository.marcarFacturada).toHaveBeenCalledWith('r1', 'f1');
      expect(resultado).toEqual({ facturaId: 'f1', numero: '000010', total: 5000 });
    });
  });
});
