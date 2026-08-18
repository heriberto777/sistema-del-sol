import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosRepository } from './pos.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';

describe('PosService', () => {
  let service: PosService;
  let posRepository: jest.Mocked<PosRepository>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let configuracionesService: jest.Mocked<ConfiguracionesService>;

  beforeEach(() => {
    posRepository = {
      buscarTurnoAbierto: jest.fn(),
      crearTurno: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      listarCajeros: jest.fn(),
      crearMovimiento: jest.fn(),
      calcularMovimientoEfectivo: jest.fn(),
      cerrarTurno: jest.fn(),
    } as unknown as jest.Mocked<PosRepository>;
    facturacionService = { crear: jest.fn() } as unknown as jest.Mocked<FacturacionService>;
    configuracionesService = { buscarValor: jest.fn().mockResolvedValue('50') } as unknown as jest.Mocked<ConfiguracionesService>;
    service = new PosService(posRepository, facturacionService, configuracionesService);
  });

  describe('listar', () => {
    it('pasa la búsqueda al repositorio junto al resto de filtros', async () => {
      posRepository.listar.mockResolvedValue([[{ id: 't1' }], 1] as never);

      const resultado = await service.listar({ pagina: 1, tamanoPagina: 20, busqueda: 'María' });

      expect(posRepository.listar).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, busqueda: 'María' }),
      );
      expect(resultado).toEqual({ datos: [{ id: 't1' }], total: 1, pagina: 1, tamanoPagina: 20 });
    });
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
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', montoInicial: 1000, cajeroId: 'cajero-1' } as never);
      posRepository.calcularMovimientoEfectivo.mockResolvedValue({ ventasEfectivo: 2000, entradas: 100, salidas: 300 });
      posRepository.cerrarTurno.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

      await service.cerrarTurno('t1', { montoFinalContado: 2750 }, 'cajero-1', 'tenant-1', false);

      // esperado = 1000 + 2000 + 100 - 300 = 2800; contado 2750 -> diferencia -50 (faltante, en el límite de la tolerancia default 50, no exige justificación)
      expect(posRepository.cerrarTurno).toHaveBeenCalledWith('t1', {
        montoFinalContado: 2750,
        montoEsperado: 2800,
        diferencia: -50,
        cerradoPorId: 'cajero-1',
        justificacionDiferencia: undefined,
      });
    });

    it('rechaza cerrar un turno que ya está cerrado', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'CERRADO', cajeroId: 'cajero-1' } as never);

      await expect(service.cerrarTurno('t1', { montoFinalContado: 100 }, 'cajero-1', 'tenant-1', false)).rejects.toThrow(BadRequestException);
    });

    it('rechaza con 403 si otro cajero sin pos.supervisar intenta cerrarlo', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', montoInicial: 1000, cajeroId: 'cajero-1' } as never);

      await expect(service.cerrarTurno('t1', { montoFinalContado: 100 }, 'otro-usuario', 'tenant-1', false)).rejects.toThrow(
        ForbiddenException,
      );
      expect(posRepository.cerrarTurno).not.toHaveBeenCalled();
    });

    it('permite cerrar el turno de otro cajero si tiene pos.supervisar', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', montoInicial: 1000, cajeroId: 'cajero-1' } as never);
      posRepository.calcularMovimientoEfectivo.mockResolvedValue({ ventasEfectivo: 0, entradas: 0, salidas: 0 });
      posRepository.cerrarTurno.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

      await service.cerrarTurno('t1', { montoFinalContado: 1000 }, 'supervisor-1', 'tenant-1', true);

      expect(posRepository.cerrarTurno).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ cerradoPorId: 'supervisor-1' }),
      );
    });

    it('exige justificación si la diferencia supera la tolerancia configurada, y la rechaza sin ella', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', montoInicial: 1000, cajeroId: 'cajero-1' } as never);
      posRepository.calcularMovimientoEfectivo.mockResolvedValue({ ventasEfectivo: 0, entradas: 0, salidas: 0 });

      // esperado = 1000, contado 900 -> diferencia -100, supera la tolerancia default de 50.
      await expect(service.cerrarTurno('t1', { montoFinalContado: 900 }, 'cajero-1', 'tenant-1', false)).rejects.toThrow(
        BadRequestException,
      );
      expect(posRepository.cerrarTurno).not.toHaveBeenCalled();
    });

    it('acepta una diferencia que supera la tolerancia si viene con justificación', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', montoInicial: 1000, cajeroId: 'cajero-1' } as never);
      posRepository.calcularMovimientoEfectivo.mockResolvedValue({ ventasEfectivo: 0, entradas: 0, salidas: 0 });
      posRepository.cerrarTurno.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

      await service.cerrarTurno(
        't1',
        { montoFinalContado: 900, justificacionDiferencia: 'Error al dar cambio en una venta' },
        'cajero-1',
        'tenant-1',
        false,
      );

      expect(posRepository.cerrarTurno).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ justificacionDiferencia: 'Error al dar cambio en una venta' }),
      );
    });

    it('usa una tolerancia configurada distinta del default si el tenant la cambió', async () => {
      configuracionesService.buscarValor.mockResolvedValue('200');
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', montoInicial: 1000, cajeroId: 'cajero-1' } as never);
      posRepository.calcularMovimientoEfectivo.mockResolvedValue({ ventasEfectivo: 0, entradas: 0, salidas: 0 });
      posRepository.cerrarTurno.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

      // diferencia -100, dentro de la tolerancia configurada de 200 -> no exige justificación.
      await service.cerrarTurno('t1', { montoFinalContado: 900 }, 'cajero-1', 'tenant-1', false);

      expect(posRepository.cerrarTurno).toHaveBeenCalledWith('t1', expect.objectContaining({ justificacionDiferencia: undefined }));
    });
  });
});
