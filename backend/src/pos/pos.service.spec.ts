import { BadRequestException } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosRepository } from './pos.repository';
import { FacturacionService } from '../facturacion/facturacion.service';

describe('PosService', () => {
  let service: PosService;
  let posRepository: jest.Mocked<PosRepository>;
  let facturacionService: jest.Mocked<FacturacionService>;

  beforeEach(() => {
    posRepository = {
      buscarTurnoAbierto: jest.fn(),
      crearTurno: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      crearMovimiento: jest.fn(),
      calcularMovimientoEfectivo: jest.fn(),
      cerrarTurno: jest.fn(),
    } as unknown as jest.Mocked<PosRepository>;
    facturacionService = { crear: jest.fn() } as unknown as jest.Mocked<FacturacionService>;
    service = new PosService(posRepository, facturacionService);
  });

  describe('abrirTurno', () => {
    it('rechaza abrir un turno si la bodega ya tiene uno abierto', async () => {
      posRepository.buscarTurnoAbierto.mockResolvedValue({ id: 't1' } as never);

      await expect(service.abrirTurno({ bodegaId: 'b1', montoInicial: 1000 }, 'tenant-1', 'cajero-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(posRepository.crearTurno).not.toHaveBeenCalled();
    });

    it('crea el turno si no hay uno abierto para esa bodega', async () => {
      posRepository.buscarTurnoAbierto.mockResolvedValue(null);
      posRepository.crearTurno.mockResolvedValue({ id: 't1' } as never);

      await service.abrirTurno({ bodegaId: 'b1', montoInicial: 1000 }, 'tenant-1', 'cajero-1');

      expect(posRepository.crearTurno).toHaveBeenCalledWith({ tenantId: 'tenant-1', bodegaId: 'b1', cajeroId: 'cajero-1', montoInicial: 1000 });
    });
  });

  describe('registrarMovimiento', () => {
    it('rechaza registrar un movimiento en un turno que no está abierto', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

      await expect(service.registrarMovimiento('t1', { tipo: 'SALIDA', monto: 500, concepto: 'Compra de insumos' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('registra el movimiento si el turno está abierto', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO' } as never);

      await service.registrarMovimiento('t1', { tipo: 'SALIDA', monto: 500, concepto: 'Compra de insumos' });

      expect(posRepository.crearMovimiento).toHaveBeenCalledWith({ turnoId: 't1', tipo: 'SALIDA', monto: 500, concepto: 'Compra de insumos' });
    });
  });

  describe('registrarVenta', () => {
    it('delega en FacturacionService.crear forzando CONTADO y la bodega del turno', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', bodegaId: 'b1' } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1' } as never);

      await service.registrarVenta(
        { turnoCajaId: 't1', clienteId: 'c1', metodoPago: 'EFECTIVO', lineas: [{ productoId: 'p1', cantidad: 1 }] },
        'tenant-1',
        'cajero-1',
      );

      expect(facturacionService.crear).toHaveBeenCalledWith(
        { clienteId: 'c1', bodegaId: 'b1', tipoFactura: 'CONTADO', lineas: [{ productoId: 'p1', cantidad: 1 }] },
        'tenant-1',
        'cajero-1',
        { metodoPago: 'EFECTIVO', turnoCajaId: 't1' },
      );
    });

    it('rechaza vender contra un turno que no está abierto', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'CERRADO', bodegaId: 'b1' } as never);

      await expect(
        service.registrarVenta({ turnoCajaId: 't1', clienteId: 'c1', metodoPago: 'EFECTIVO', lineas: [{ productoId: 'p1', cantidad: 1 }] }, 'tenant-1', 'cajero-1'),
      ).rejects.toThrow(BadRequestException);
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });
  });

  describe('cerrarTurno', () => {
    it('calcula montoEsperado = inicial + ventas efectivo + entradas - salidas, y la diferencia contra lo contado', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', montoInicial: 1000 } as never);
      posRepository.calcularMovimientoEfectivo.mockResolvedValue({ ventasEfectivo: 2000, entradas: 100, salidas: 300 });
      posRepository.cerrarTurno.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

      await service.cerrarTurno('t1', { montoFinalContado: 2750 });

      // esperado = 1000 + 2000 + 100 - 300 = 2800; contado 2750 -> diferencia -50 (faltante)
      expect(posRepository.cerrarTurno).toHaveBeenCalledWith('t1', { montoFinalContado: 2750, montoEsperado: 2800, diferencia: -50 });
    });

    it('rechaza cerrar un turno que ya está cerrado', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

      await expect(service.cerrarTurno('t1', { montoFinalContado: 100 })).rejects.toThrow(BadRequestException);
    });
  });
});
