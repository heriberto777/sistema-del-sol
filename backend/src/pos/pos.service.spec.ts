import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosRepository } from './pos.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';
import { FormasPagoRepository } from '../formas-pago/formas-pago.repository';
import { EmpleadosRepository } from '../nomina/empleados.repository';
import { VariantesService } from '../variantes/variantes.service';
import { InventarioService } from '../inventario/inventario.service';
import { AuthService } from '../auth/auth.service';

describe('PosService', () => {
  let service: PosService;
  let posRepository: jest.Mocked<PosRepository>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let configuracionesService: jest.Mocked<ConfiguracionesService>;
  let formasPagoRepository: jest.Mocked<FormasPagoRepository>;
  let empleadosRepository: jest.Mocked<EmpleadosRepository>;
  let variantesService: jest.Mocked<VariantesService>;
  let inventarioService: jest.Mocked<InventarioService>;
  let authService: jest.Mocked<AuthService>;

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
      guardarVenta: jest.fn(),
      listarGuardadas: jest.fn(),
      eliminarGuardada: jest.fn(),
    } as unknown as jest.Mocked<PosRepository>;
    facturacionService = { crear: jest.fn(), buscarPorId: jest.fn(), cotizar: jest.fn() } as unknown as jest.Mocked<FacturacionService>;
    configuracionesService = { buscarValor: jest.fn().mockResolvedValue('50') } as unknown as jest.Mocked<ConfiguracionesService>;
    formasPagoRepository = { buscarPorId: jest.fn().mockResolvedValue({ id: 'fp1' }) } as unknown as jest.Mocked<FormasPagoRepository>;
    empleadosRepository = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 'emp1' }),
      listarVendedores: jest.fn(),
    } as unknown as jest.Mocked<EmpleadosRepository>;
    variantesService = {
      resolverObligatoria: jest.fn().mockResolvedValue('variante-1'),
    } as unknown as jest.Mocked<VariantesService>;
    inventarioService = {
      validarAccesoBodega: jest.fn().mockResolvedValue({ id: 'b1', sucursalId: 's1' }),
    } as unknown as jest.Mocked<InventarioService>;
    authService = {
      verificarPin: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthService>;
    service = new PosService(
      posRepository,
      facturacionService,
      configuracionesService,
      formasPagoRepository,
      empleadosRepository,
      variantesService,
      inventarioService,
      authService,
    );
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

      expect(inventarioService.validarAccesoBodega).toHaveBeenCalledWith('b1', 'cajero-1');
      expect(posRepository.crearTurno).toHaveBeenCalledWith({ tenantId: 'tenant-1', bodegaId: 'b1', cajeroId: 'cajero-1', montoInicial: 1000 });
    });

    it('Fase 9: propaga el rechazo (bodega ajena o sin acceso a su sucursal) sin crear el turno', async () => {
      inventarioService.validarAccesoBodega.mockRejectedValue(new ForbiddenException('No tenés acceso a la sucursal de esta bodega'));

      await expect(service.abrirTurno({ bodegaId: 'b1', montoInicial: 1000 }, 'tenant-1', 'cajero-1')).rejects.toThrow(ForbiddenException);
      expect(posRepository.crearTurno).not.toHaveBeenCalled();
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

  describe('cotizar (Fase 4c, gap Ofertas+POS)', () => {
    it('delega en FacturacionService.cotizar sin resolver turno ni bodega (no tiene efectos secundarios)', async () => {
      facturacionService.cotizar.mockResolvedValue({ subtotal: 180, descuento: 20, itbis: 32.4, total: 212.4, lineas: [] } as never);

      const resultado = await service.cotizar({ clienteId: 'c1', lineas: [{ productoId: 'p1', cantidad: 2 }] });

      expect(facturacionService.cotizar).toHaveBeenCalledWith({ clienteId: 'c1', lineas: [{ productoId: 'p1', cantidad: 2 }] });
      expect(posRepository.buscarPorId).not.toHaveBeenCalled();
      expect(resultado).toEqual(expect.objectContaining({ total: 212.4 }));
    });
  });

  describe('registrarVenta', () => {
    it('delega en FacturacionService.crear forzando CONTADO y la bodega del turno', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', bodegaId: 'b1' } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1' } as never);

      await service.registrarVenta(
        { turnoCajaId: 't1', clienteId: 'c1', pagos: [{ formaPagoId: 'fp1', monto: 177 }], lineas: [{ productoId: 'p1', cantidad: 1 }] },
        'tenant-1',
        'cajero-1',
      );

      expect(facturacionService.crear).toHaveBeenCalledWith(
        { clienteId: 'c1', bodegaId: 'b1', tipoFactura: 'CONTADO', lineas: [{ productoId: 'p1', cantidad: 1 }] },
        'tenant-1',
        'cajero-1',
        { turnoCajaId: 't1', vendedorEmpleadoId: undefined, pagos: [{ formaPagoId: 'fp1', monto: 177 }] },
      );
    });

    it('valida vendedorEmpleadoId contra el tenant cuando viene en el DTO y lo propaga a FacturacionService.crear', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', bodegaId: 'b1' } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1' } as never);

      await service.registrarVenta(
        {
          turnoCajaId: 't1',
          clienteId: 'c1',
          pagos: [{ formaPagoId: 'fp1', monto: 177 }],
          vendedorEmpleadoId: 'emp1',
          lineas: [{ productoId: 'p1', cantidad: 1 }],
        } as never,
        'tenant-1',
        'cajero-1',
      );

      expect(empleadosRepository.buscarPorId).toHaveBeenCalledWith('emp1');
      expect(facturacionService.crear).toHaveBeenCalledWith(
        expect.anything(),
        'tenant-1',
        'cajero-1',
        expect.objectContaining({ vendedorEmpleadoId: 'emp1' }),
      );
    });

    it('no valida vendedorEmpleadoId si no viene en el DTO', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', bodegaId: 'b1' } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1' } as never);

      await service.registrarVenta(
        { turnoCajaId: 't1', clienteId: 'c1', pagos: [{ formaPagoId: 'fp1', monto: 177 }], lineas: [{ productoId: 'p1', cantidad: 1 }] },
        'tenant-1',
        'cajero-1',
      );

      expect(empleadosRepository.buscarPorId).not.toHaveBeenCalled();
    });

    it('valida que cada formaPagoId de `pagos` pertenezca al tenant antes de vender (404 si no, vía findUniqueOrThrow tenant-scoped)', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', bodegaId: 'b1' } as never);
      facturacionService.crear.mockResolvedValue({ id: 'f1' } as never);

      await service.registrarVenta(
        {
          turnoCajaId: 't1',
          clienteId: 'c1',
          pagos: [{ formaPagoId: 'fp1', monto: 100 }, { formaPagoId: 'fp2', monto: 77 }],
          lineas: [{ productoId: 'p1', cantidad: 1 }],
        },
        'tenant-1',
        'cajero-1',
      );

      expect(formasPagoRepository.buscarPorId).toHaveBeenCalledWith('fp1');
      expect(formasPagoRepository.buscarPorId).toHaveBeenCalledWith('fp2');
    });

    it('rechaza vender contra un turno que no está abierto', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'CERRADO', bodegaId: 'b1' } as never);

      await expect(
        service.registrarVenta(
          { turnoCajaId: 't1', clienteId: 'c1', pagos: [{ formaPagoId: 'fp1', monto: 177 }], lineas: [{ productoId: 'p1', cantidad: 1 }] },
          'tenant-1',
          'cajero-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });
  });

  describe('registrarDevolucion', () => {
    const turno = { id: 't1', estado: 'ABIERTO', bodegaId: 'b1' };
    const facturaOrigenBase = {
      id: 'f1',
      estado: 'EMITIDA',
      tipoFactura: 'CONTADO',
      clienteId: 'c1',
      lineas: [{ productoId: 'p1', cantidad: 5, precioUnitario: 100, descuento: 50 }],
      notasRelacionadas: [],
    };

    it('rechaza devolver contra un turno que no está abierto', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

      await expect(
        service.registrarDevolucion(
          { facturaOrigenId: 'f1', turnoCajaId: 't1', formaPagoId: 'fp1', lineas: [{ productoId: 'p1', cantidad: 1 }] },
          'tenant-1',
          'cajero-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });

    it('rechaza devolver una factura que no está EMITIDA', async () => {
      posRepository.buscarPorId.mockResolvedValue(turno as never);
      facturacionService.buscarPorId.mockResolvedValue({ ...facturaOrigenBase, estado: 'ANULADA' } as never);

      await expect(
        service.registrarDevolucion(
          { facturaOrigenId: 'f1', turnoCajaId: 't1', formaPagoId: 'fp1', lineas: [{ productoId: 'p1', cantidad: 1 }] },
          'tenant-1',
          'cajero-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza devolver una nota de crédito', async () => {
      posRepository.buscarPorId.mockResolvedValue(turno as never);
      facturacionService.buscarPorId.mockResolvedValue({ ...facturaOrigenBase, tipoFactura: 'NOTA_CREDITO' } as never);

      await expect(
        service.registrarDevolucion(
          { facturaOrigenId: 'f1', turnoCajaId: 't1', formaPagoId: 'fp1', lineas: [{ productoId: 'p1', cantidad: 1 }] },
          'tenant-1',
          'cajero-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza devolver más cantidad de la disponible', async () => {
      posRepository.buscarPorId.mockResolvedValue(turno as never);
      facturacionService.buscarPorId.mockResolvedValue(facturaOrigenBase as never);

      await expect(
        service.registrarDevolucion(
          { facturaOrigenId: 'f1', turnoCajaId: 't1', formaPagoId: 'fp1', lineas: [{ productoId: 'p1', cantidad: 6 }] },
          'tenant-1',
          'cajero-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });

    it('descuenta lo ya devuelto por notas de crédito previas antes de validar la disponible', async () => {
      posRepository.buscarPorId.mockResolvedValue(turno as never);
      facturacionService.buscarPorId.mockResolvedValue({
        ...facturaOrigenBase,
        notasRelacionadas: [{ lineas: [{ productoId: 'p1', cantidad: 3 }] }],
      } as never);

      await expect(
        service.registrarDevolucion(
          { facturaOrigenId: 'f1', turnoCajaId: 't1', formaPagoId: 'fp1', lineas: [{ productoId: 'p1', cantidad: 3 }] },
          'tenant-1',
          'cajero-1',
        ),
      ).rejects.toThrow(BadRequestException); // 5 - 3 ya devueltas = 2 disponibles, se piden 3
    });

    it('crea una NOTA_CREDITO con el precio/descuento proporcional de la línea original, contra la bodega del turno', async () => {
      posRepository.buscarPorId.mockResolvedValue(turno as never);
      facturacionService.buscarPorId.mockResolvedValue(facturaOrigenBase as never);
      facturacionService.crear.mockResolvedValue({ id: 'nc1' } as never);

      await service.registrarDevolucion(
        { facturaOrigenId: 'f1', turnoCajaId: 't1', formaPagoId: 'fp1', referenciaPago: 'ref', lineas: [{ productoId: 'p1', cantidad: 2 }] },
        'tenant-1',
        'cajero-1',
      );

      expect(facturacionService.crear).toHaveBeenCalledWith(
        {
          clienteId: 'c1',
          bodegaId: 'b1',
          tipoFactura: 'NOTA_CREDITO',
          facturaOrigenId: 'f1',
          lineas: [{ productoId: 'p1', cantidad: 2, precioUnitario: 100, descuento: 20 }], // descuento 50 * 2/5 = 20
        },
        'tenant-1',
        'cajero-1',
        { formaPagoId: 'fp1', referenciaPago: 'ref', turnoCajaId: 't1' },
      );
    });
  });

  describe('obtenerFacturaParaDevolucion', () => {
    it('calcula lo disponible por producto descontando lo ya devuelto por notas previas', async () => {
      facturacionService.buscarPorId.mockResolvedValue({
        id: 'f1',
        ncf: 'B0200000001',
        clienteId: 'c1',
        estado: 'EMITIDA',
        tipoFactura: 'CONTADO',
        lineas: [{ productoId: 'p1', cantidad: 5, producto: { nombre: 'Producto 1', codigo: 'P1' } }],
        notasRelacionadas: [{ lineas: [{ productoId: 'p1', cantidad: 2 }] }],
      } as never);

      const resultado = await service.obtenerFacturaParaDevolucion('f1');

      expect(resultado).toEqual({
        id: 'f1',
        ncf: 'B0200000001',
        clienteId: 'c1',
        lineas: [{ productoId: 'p1', nombre: 'Producto 1', codigo: 'P1', cantidadOriginal: 5, disponible: 3 }],
      });
    });

    it('rechaza una factura que no está EMITIDA', async () => {
      facturacionService.buscarPorId.mockResolvedValue({ estado: 'ANULADA', tipoFactura: 'CONTADO', lineas: [] } as never);

      await expect(service.obtenerFacturaParaDevolucion('f1')).rejects.toThrow(BadRequestException);
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

    describe('Fase 9 — PIN de confirmación', () => {
      it('NO pide PIN en un cierre normal (propio turno, sin diferencia)', async () => {
        posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', montoInicial: 1000, cajeroId: 'cajero-1' } as never);
        posRepository.calcularMovimientoEfectivo.mockResolvedValue({ ventasEfectivo: 0, entradas: 0, salidas: 0 });
        posRepository.cerrarTurno.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

        await service.cerrarTurno('t1', { montoFinalContado: 1000 }, 'cajero-1', 'tenant-1', false);

        expect(authService.verificarPin).not.toHaveBeenCalled();
      });

      it('pide y valida el PIN cuando la diferencia supera la tolerancia (con justificación)', async () => {
        posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', montoInicial: 1000, cajeroId: 'cajero-1' } as never);
        posRepository.calcularMovimientoEfectivo.mockResolvedValue({ ventasEfectivo: 0, entradas: 0, salidas: 0 });
        posRepository.cerrarTurno.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

        await service.cerrarTurno(
          't1',
          { montoFinalContado: 900, justificacionDiferencia: 'Error al dar cambio', pin: '1234' },
          'cajero-1',
          'tenant-1',
          false,
        );

        expect(authService.verificarPin).toHaveBeenCalledWith('cajero-1', '1234');
      });

      it('propaga el PIN incorrecto sin cerrar el turno, aunque la justificación esté presente', async () => {
        posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', montoInicial: 1000, cajeroId: 'cajero-1' } as never);
        posRepository.calcularMovimientoEfectivo.mockResolvedValue({ ventasEfectivo: 0, entradas: 0, salidas: 0 });
        authService.verificarPin.mockRejectedValue(new Error('PIN incorrecto'));

        await expect(
          service.cerrarTurno(
            't1',
            { montoFinalContado: 900, justificacionDiferencia: 'Error al dar cambio', pin: 'mal' },
            'cajero-1',
            'tenant-1',
            false,
          ),
        ).rejects.toThrow('PIN incorrecto');
        expect(posRepository.cerrarTurno).not.toHaveBeenCalled();
      });

      it('pide PIN al cerrar el turno de otro cajero, aunque no haya diferencia', async () => {
        posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO', montoInicial: 1000, cajeroId: 'cajero-1' } as never);
        posRepository.calcularMovimientoEfectivo.mockResolvedValue({ ventasEfectivo: 0, entradas: 0, salidas: 0 });
        posRepository.cerrarTurno.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

        await service.cerrarTurno('t1', { montoFinalContado: 1000, pin: '1234' }, 'supervisor-1', 'tenant-1', true);

        expect(authService.verificarPin).toHaveBeenCalledWith('supervisor-1', '1234');
      });
    });
  });

  describe('guardarVenta', () => {
    it('rechaza aparcar una venta contra un turno que no está abierto', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'CERRADO' } as never);

      await expect(
        service.guardarVenta('t1', { lineas: [{ productoId: 'p1', cantidad: 1, precioUnitario: 100, porcentajeItbis: 18 }] } as never, 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
      expect(posRepository.guardarVenta).not.toHaveBeenCalled();
    });

    it('guarda la venta aparcada con el turnoCajaId y tenantId correctos', async () => {
      posRepository.buscarPorId.mockResolvedValue({ id: 't1', estado: 'ABIERTO' } as never);
      posRepository.guardarVenta.mockResolvedValue({ id: 'va1' } as never);

      const dto = { clienteId: 'c1', lineas: [{ productoId: 'p1', cantidad: 1, precioUnitario: 100, porcentajeItbis: 18 }] } as never;
      await service.guardarVenta('t1', dto, 'tenant-1');

      expect(posRepository.guardarVenta).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', turnoCajaId: 't1', clienteId: 'c1' }),
      );
    });
  });

  describe('listarGuardadas', () => {
    it('delega en el repositorio con el turnoId recibido', async () => {
      posRepository.listarGuardadas.mockResolvedValue([{ id: 'va1' }] as never);

      const resultado = await service.listarGuardadas('t1');

      expect(posRepository.listarGuardadas).toHaveBeenCalledWith('t1');
      expect(resultado).toEqual([{ id: 'va1' }]);
    });
  });

  describe('eliminarGuardada', () => {
    it('delega en el repositorio (tenant-scoped vía TenantPrismaService)', async () => {
      posRepository.eliminarGuardada.mockResolvedValue({ id: 'va1' } as never);

      await service.eliminarGuardada('va1');

      expect(posRepository.eliminarGuardada).toHaveBeenCalledWith('va1');
    });
  });

  describe('listarVendedores', () => {
    it('delega en EmpleadosRepository.listarVendedores con la búsqueda recibida', async () => {
      empleadosRepository.listarVendedores.mockResolvedValue([{ id: 'emp1', nombre: 'Juan Pérez' }] as never);

      const resultado = await service.listarVendedores('juan');

      expect(empleadosRepository.listarVendedores).toHaveBeenCalledWith('juan');
      expect(resultado).toEqual([{ id: 'emp1', nombre: 'Juan Pérez' }]);
    });
  });
});
