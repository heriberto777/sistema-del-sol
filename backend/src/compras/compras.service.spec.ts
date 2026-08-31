import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ComprasService } from './compras.service';
import { ComprasRepository } from './compras.repository';
import { InventarioService } from '../inventario/inventario.service';
import { VariantesService } from '../variantes/variantes.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { RecibirOrdenCompraDto } from './dto/recibir-orden-compra.dto';
import { PagosService } from '../pagos/pagos.service';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';

describe('ComprasService', () => {
  let service: ComprasService;
  let repository: jest.Mocked<ComprasRepository>;
  let inventarioService: jest.Mocked<InventarioService>;
  let variantesService: jest.Mocked<VariantesService>;
  let tenantPrisma: { client: { $transaction: jest.Mock; producto: { findMany: jest.Mock } } };
  let eventBus: jest.Mocked<EventBusService>;
  let pagosService: jest.Mocked<PagosService>;
  let correlativosRepository: jest.Mocked<CorrelativosRepository>;

  // Ver el mismo patrón en facturacion.service.spec.ts: un tx opaco pasado
  // por $transaction a los métodos *EnTx — no necesita comportarse como un
  // Prisma.TransactionClient real para estas pruebas.
  const TX = { esTransaccion: true };

  beforeEach(() => {
    repository = {
      crearOrdenEnTx: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorIdEnTx: jest.fn(),
      actualizar: jest.fn(),
      actualizarEstado: jest.fn(),
      actualizarCantidadRecibida: jest.fn(),
      crearRecepcion: jest.fn(),
      crearDevolucionEnTx: jest.fn(),
    } as unknown as jest.Mocked<ComprasRepository>;
    inventarioService = {
      entradaStockEnTx: jest.fn(),
      verificarYDescontarStockEnTx: jest.fn(),
      validarAccesoBodega: jest.fn().mockResolvedValue({ id: 'bodega-1', sucursalId: 's1' }),
    } as unknown as jest.Mocked<InventarioService>;
    tenantPrisma = {
      client: {
        $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(TX)),
        producto: { findMany: jest.fn().mockResolvedValue([]) },
      },
    };
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    pagosService = {
      registrarPagoFactura: jest.fn(),
      registrarPagoOrdenCompra: jest.fn(),
      listarPorFactura: jest.fn(),
      listarPorOrdenCompra: jest.fn(),
    } as unknown as jest.Mocked<PagosService>;
    variantesService = {
      resolverObligatoria: jest.fn().mockResolvedValue('variante-1'),
    } as unknown as jest.Mocked<VariantesService>;
    correlativosRepository = { siguienteEnTx: jest.fn().mockResolvedValue('OC-00001') } as unknown as jest.Mocked<CorrelativosRepository>;
    service = new ComprasService(
      repository,
      inventarioService,
      variantesService,
      tenantPrisma as unknown as TenantPrismaService,
      eventBus,
      pagosService,
      correlativosRepository,
    );
  });

  describe('crear', () => {
    it('calcula el total como suma de cantidad * costoUnitario de cada línea', async () => {
      await service.crear(
        {
          proveedorId: 'prov-1',
          lineas: [
            { productoId: 'p1', cantidad: 10, costoUnitario: 5 },
            { productoId: 'p2', cantidad: 3, costoUnitario: 20 },
          ],
        },
        'user-1',
        'tenant-1',
      );

      expect(correlativosRepository.siguienteEnTx).toHaveBeenCalledWith(TX, 'tenant-1', 'ORDEN_COMPRA');
      expect(repository.crearOrdenEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1', total: 110, numero: 'OC-00001' }),
      );
    });

    it('rechaza una línea cuyo producto es un COMBO — no se compra armado, se compran sus componentes', async () => {
      tenantPrisma.client.producto.findMany.mockResolvedValue([{ id: 'p1', nombre: 'Combo X', tipo: 'COMBO' }] as never);

      await expect(
        service.crear(
          { proveedorId: 'prov-1', lineas: [{ productoId: 'p1', cantidad: 1, costoUnitario: 100 }] },
          'user-1',
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.crearOrdenEnTx).not.toHaveBeenCalled();
    });
  });

  describe('recibir', () => {
    function ordenBase(cantidadRecibidaLinea: number) {
      return {
        numero: 'OC-001',
        proveedorId: 'prov-1',
        total: 500,
        lineas: [{ id: 'linea-1', productoId: 'p1', cantidad: 10, cantidadRecibida: cantidadRecibidaLinea, producto: { tipo: 'PRODUCTO' } }],
      };
    }

    const dtoRecepcion: RecibirOrdenCompraDto = {
      bodegaId: 'bodega-1',
      lineas: [{ productoId: 'p1', cantidadRecibida: 10, costoUnitario: 5 }],
    };

    it('Fase 9: valida acceso a la sucursal de la bodega destino antes de recibir', async () => {
      inventarioService.validarAccesoBodega.mockRejectedValue(new ForbiddenException('No tenés acceso a la sucursal de esta bodega'));

      await expect(service.recibir('oc-1', dtoRecepcion, 'user-1', 'tenant-1')).rejects.toThrow(ForbiddenException);
      expect(inventarioService.validarAccesoBodega).toHaveBeenCalledWith('bodega-1', 'user-1');
      expect(repository.buscarPorId).not.toHaveBeenCalled();
    });

    it('ítem E-1: rechaza recibir mercancía de una orden cancelada', async () => {
      repository.buscarPorId.mockResolvedValue({ ...ordenBase(0), estado: 'CANCELADA' } as never);

      await expect(service.recibir('oc-1', dtoRecepcion, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.crearRecepcion).not.toHaveBeenCalled();
    });

    it('marca RECIBIDA_TOTAL cuando la cantidad recibida acumulada cubre lo pedido', async () => {
      repository.buscarPorId.mockResolvedValue(ordenBase(0) as never); // antes de recibir
      repository.buscarPorIdEnTx.mockResolvedValue(ordenBase(10) as never); // después de actualizar, dentro de la tx
      repository.crearRecepcion.mockResolvedValue({ id: 'rec-1' } as never);

      await service.recibir('oc-1', dtoRecepcion, 'user-1', 'tenant-1');

      expect(repository.actualizarEstado).toHaveBeenCalledWith(TX, 'oc-1', 'RECIBIDA_TOTAL');
    });

    it('marca RECIBIDA_PARCIAL cuando aún falta cantidad por recibir', async () => {
      repository.buscarPorId.mockResolvedValue(ordenBase(0) as never);
      repository.buscarPorIdEnTx.mockResolvedValue(ordenBase(4) as never); // solo 4 de 10 recibidos
      repository.crearRecepcion.mockResolvedValue({ id: 'rec-1' } as never);

      await service.recibir(
        'oc-1',
        { ...dtoRecepcion, lineas: [{ productoId: 'p1', cantidadRecibida: 4, costoUnitario: 5 }] },
        'user-1',
        'tenant-1',
      );

      expect(repository.actualizarEstado).toHaveBeenCalledWith(TX, 'oc-1', 'RECIBIDA_PARCIAL');
    });

    it('actualiza la entrada de inventario por cada línea recibida, dentro de la misma transacción', async () => {
      repository.buscarPorId.mockResolvedValue(ordenBase(0) as never);
      repository.buscarPorIdEnTx.mockResolvedValue(ordenBase(10) as never);
      repository.crearRecepcion.mockResolvedValue({ id: 'rec-1' } as never);

      await service.recibir('oc-1', dtoRecepcion, 'user-1', 'tenant-1');

      expect(inventarioService.entradaStockEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ tenantId: 'tenant-1', productoId: 'p1', bodegaId: 'bodega-1', cantidad: 10, userId: 'user-1' }),
      );
      expect(tenantPrisma.client.$transaction).toHaveBeenCalledTimes(1);
      expect(repository.crearRecepcion).toHaveBeenCalledWith(TX, expect.anything());
    });

    it('Fase 5b: propaga numeroLote/fechaVencimiento y referenciaTipo/referenciaId a entradaStockEnTx', async () => {
      repository.buscarPorId.mockResolvedValue(ordenBase(0) as never);
      repository.buscarPorIdEnTx.mockResolvedValue(ordenBase(10) as never);
      repository.crearRecepcion.mockResolvedValue({ id: 'rec-1' } as never);
      const fechaVencimiento = new Date('2026-12-01');

      await service.recibir(
        'oc-1',
        { bodegaId: 'bodega-1', lineas: [{ productoId: 'p1', cantidadRecibida: 10, costoUnitario: 5, numeroLote: 'L1', fechaVencimiento }] },
        'user-1',
        'tenant-1',
      );

      expect(inventarioService.entradaStockEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({
          referenciaTipo: 'RECEPCION_COMPRA',
          referenciaId: 'rec-1',
          lotes: [{ numeroLote: 'L1', fechaVencimiento, cantidad: 10 }],
        }),
      );
    });

    it('un producto SERVICIO no mueve inventario al recibirse (solo actualiza la cantidad recibida)', async () => {
      const ordenConServicio = {
        numero: 'OC-001',
        proveedorId: 'prov-1',
        total: 500,
        lineas: [{ id: 'linea-1', productoId: 'p1', cantidad: 10, cantidadRecibida: 0, producto: { tipo: 'SERVICIO' } }],
      };
      repository.buscarPorId.mockResolvedValue(ordenConServicio as never);
      repository.buscarPorIdEnTx.mockResolvedValue(ordenConServicio as never);
      repository.crearRecepcion.mockResolvedValue({ id: 'rec-1' } as never);

      await service.recibir('oc-1', dtoRecepcion, 'user-1', 'tenant-1');

      expect(inventarioService.entradaStockEnTx).not.toHaveBeenCalled();
      expect(repository.actualizarCantidadRecibida).toHaveBeenCalledWith(TX, 'linea-1', 10);
    });

    it('no rompe si una línea recibida no corresponde a ninguna línea de la OC original (igual descuenta stock)', async () => {
      repository.buscarPorId.mockResolvedValue(ordenBase(0) as never);
      repository.buscarPorIdEnTx.mockResolvedValue(ordenBase(0) as never);
      repository.crearRecepcion.mockResolvedValue({ id: 'rec-1' } as never);

      await service.recibir(
        'oc-1',
        { bodegaId: 'bodega-1', lineas: [{ productoId: 'producto-no-en-oc', cantidadRecibida: 2, costoUnitario: 5 }] },
        'user-1',
        'tenant-1',
      );

      expect(repository.actualizarCantidadRecibida).not.toHaveBeenCalled();
      expect(inventarioService.entradaStockEnTx).toHaveBeenCalled();
    });

    it('calcula diferenciaVsFactura contra el monto de ESTA recepción (recepción única = orden completa)', async () => {
      repository.buscarPorId.mockResolvedValue(ordenBase(0) as never);
      repository.buscarPorIdEnTx.mockResolvedValue(ordenBase(10) as never);
      repository.crearRecepcion.mockResolvedValue({ id: 'rec-1' } as never);

      const resultado = await service.recibir(
        'oc-1',
        { ...dtoRecepcion, montoFacturaProveedor: 48 },
        'user-1',
        'tenant-1',
      );

      // dtoRecepcion.lineas = 10 unidades * 5 = 50 (recepción total, cubre toda la orden) -> diferencia = 50 - 48 = 2
      expect(resultado.diferenciaVsFactura).toBe(2);
    });

    it('en una recepción PARCIAL, compara contra el monto de esta recepción, no contra el total de toda la orden (regresión de un bug real)', async () => {
      // orden.total = 500 (la orden completa, p. ej. 100 unidades pedidas en total)
      repository.buscarPorId.mockResolvedValue(ordenBase(0) as never);
      repository.buscarPorIdEnTx.mockResolvedValue(ordenBase(10) as never);
      repository.crearRecepcion.mockResolvedValue({ id: 'rec-1' } as never);

      // Esta recepción es solo una FRACCIÓN de la orden: 10 unidades a 5 c/u = 50.
      const resultado = await service.recibir(
        'oc-1',
        { bodegaId: 'bodega-1', montoFacturaProveedor: 48, lineas: [{ productoId: 'p1', cantidadRecibida: 10, costoUnitario: 5 }] },
        'user-1',
        'tenant-1',
      );

      // Correcto: 50 (esta recepción) - 48 (factura de esta recepción) = 2.
      // El bug comparaba contra orden.total (500): 500 - 48 = 452, una "diferencia"
      // sin sentido que no refleja ningún desacuerdo real con el proveedor.
      expect(resultado.diferenciaVsFactura).toBe(2);
    });

    it('diferenciaVsFactura es null cuando no se envía montoFacturaProveedor', async () => {
      repository.buscarPorId.mockResolvedValue(ordenBase(0) as never);
      repository.buscarPorIdEnTx.mockResolvedValue(ordenBase(10) as never);
      repository.crearRecepcion.mockResolvedValue({ id: 'rec-1' } as never);

      const resultado = await service.recibir('oc-1', dtoRecepcion, 'user-1', 'tenant-1');

      expect(resultado.diferenciaVsFactura).toBeNull();
    });

    it('emite ORDEN_COMPRA_RECIBIDA con el proveedor y total de la orden original', async () => {
      repository.buscarPorId.mockResolvedValue(ordenBase(0) as never);
      repository.buscarPorIdEnTx.mockResolvedValue(ordenBase(10) as never);
      repository.crearRecepcion.mockResolvedValue({ id: 'rec-1' } as never);

      await service.recibir('oc-1', dtoRecepcion, 'user-1', 'tenant-1');

      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.ORDEN_COMPRA_RECIBIDA,
        expect.objectContaining({ tenantId: 'tenant-1', ordenCompraId: 'oc-1', proveedorId: 'prov-1', total: '500' }),
      );
    });
  });

  describe('actualizar (ítem E-1)', () => {
    const dtoEditar = { lineas: [{ productoId: 'p1', cantidad: 3, costoUnitario: 10 }] };

    it('rechaza editar una orden que no está en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'ENVIADA' } as never);

      await expect(service.actualizar('oc-1', dtoEditar as never, 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });

    it('reemplaza las líneas y recalcula el total de una orden en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'BORRADOR' } as never);
      repository.actualizar.mockResolvedValue({ id: 'oc-1' } as never);

      await service.actualizar('oc-1', dtoEditar as never, 'tenant-1');

      expect(repository.actualizar).toHaveBeenCalledWith('oc-1', {
        total: 30,
        lineas: [{ productoId: 'p1', cantidad: 3, costoUnitario: 10, varianteId: 'variante-1' }],
      });
    });
  });

  describe('cambiarEstado (ítem E-1)', () => {
    it('confirma (BORRADOR→ENVIADA) una orden en borrador', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'BORRADOR', recepciones: [] } as never);

      await service.cambiarEstado('oc-1', 'ENVIADA', 'tenant-1');

      expect(repository.actualizarEstado).toHaveBeenCalledWith(TX, 'oc-1', 'ENVIADA');
    });

    it('rechaza confirmar una orden que ya no está en BORRADOR', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'ENVIADA', recepciones: [] } as never);

      await expect(service.cambiarEstado('oc-1', 'ENVIADA', 'tenant-1')).rejects.toThrow(BadRequestException);
    });

    it('cancela una orden en BORRADOR o ENVIADA sin recepciones', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'ENVIADA', recepciones: [] } as never);

      await service.cambiarEstado('oc-1', 'CANCELADA', 'tenant-1');

      expect(repository.actualizarEstado).toHaveBeenCalledWith(TX, 'oc-1', 'CANCELADA');
    });

    it('rechaza cancelar una orden que ya tiene mercancía recibida', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'RECIBIDA_PARCIAL', recepciones: [{ id: 'rec-1' }] } as never);

      await expect(service.cambiarEstado('oc-1', 'CANCELADA', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(repository.actualizarEstado).not.toHaveBeenCalled();
    });

    it('rechaza cancelar una orden ya cancelada', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'CANCELADA', recepciones: [] } as never);

      await expect(service.cambiarEstado('oc-1', 'CANCELADA', 'tenant-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('registrarPago', () => {
    const dtoPago = { monto: 100, formaPagoId: 'fp1' } as never;

    it('delega en PagosService.registrarPagoOrdenCompra cuando la orden es válida', async () => {
      const orden = { id: 'oc-1', estado: 'RECIBIDA_TOTAL', pagada: false, total: 500 };
      repository.buscarPorId.mockResolvedValue(orden as never);
      pagosService.registrarPagoOrdenCompra.mockResolvedValue({ id: 'pago-1' } as never);

      await service.registrarPago('oc-1', dtoPago, 'user-1', 'tenant-1');

      expect(pagosService.registrarPagoOrdenCompra).toHaveBeenCalledWith(orden, dtoPago, 'user-1', 'tenant-1');
    });

    it('rechaza registrar pago de una orden cancelada', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'oc-1', estado: 'CANCELADA', pagada: false, total: 500 } as never);

      await expect(service.registrarPago('oc-1', dtoPago, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(pagosService.registrarPagoOrdenCompra).not.toHaveBeenCalled();
    });

    it('rechaza registrar pago de una orden ya pagada en su totalidad', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'oc-1', estado: 'RECIBIDA_TOTAL', pagada: true, total: 500 } as never);

      await expect(service.registrarPago('oc-1', dtoPago, 'user-1', 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(pagosService.registrarPagoOrdenCompra).not.toHaveBeenCalled();
    });
  });

  describe('devolver', () => {
    function ordenRecibida() {
      return {
        id: 'oc-1',
        numero: 'OC-001',
        proveedorId: 'prov-1',
        lineas: [{ id: 'linea-1', productoId: 'p1', cantidad: 10, cantidadRecibida: 10, costoUnitario: 20, producto: { tipo: 'PRODUCTO' } }],
      };
    }

    const dtoDevolucion = { bodegaId: 'bodega-1', motivo: 'Mercancía defectuosa', lineas: [{ productoId: 'p1', cantidad: 4 }] };

    it('Fase 9: valida acceso a la sucursal de la bodega de donde sale la mercancía antes de devolver', async () => {
      inventarioService.validarAccesoBodega.mockRejectedValue(new ForbiddenException('No tenés acceso a la sucursal de esta bodega'));

      await expect(service.devolver('oc-1', dtoDevolucion, 'user-1', 'tenant-1')).rejects.toThrow(ForbiddenException);
      expect(inventarioService.validarAccesoBodega).toHaveBeenCalledWith('bodega-1', 'user-1');
      expect(repository.buscarPorId).not.toHaveBeenCalled();
    });

    it('reduce cantidadRecibida, saca stock, y marca RECIBIDA_PARCIAL si ya no cubre todo lo pedido', async () => {
      repository.buscarPorId.mockResolvedValue(ordenRecibida() as never);
      tenantPrisma.client.producto.findMany.mockResolvedValue([{ id: 'p1', porcentajeItbis: 18 }] as never);
      repository.crearDevolucionEnTx.mockResolvedValue({ id: 'dev-1' } as never);
      repository.buscarPorIdEnTx.mockResolvedValue({
        lineas: [{ productoId: 'p1', cantidad: 10, cantidadRecibida: 6 }],
      } as never);

      await service.devolver('oc-1', dtoDevolucion, 'user-1', 'tenant-1');

      expect(repository.actualizarCantidadRecibida).toHaveBeenCalledWith(TX, 'linea-1', -4);
      expect(inventarioService.verificarYDescontarStockEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ tenantId: 'tenant-1', productoId: 'p1', bodegaId: 'bodega-1', cantidad: 4, userId: 'user-1' }),
      );
      expect(repository.actualizarEstado).toHaveBeenCalledWith(TX, 'oc-1', 'RECIBIDA_PARCIAL');
    });

    it('Fase 5b: propaga loteId (elegido a mano) y referenciaTipo/referenciaId a verificarYDescontarStockEnTx', async () => {
      repository.buscarPorId.mockResolvedValue(ordenRecibida() as never);
      tenantPrisma.client.producto.findMany.mockResolvedValue([{ id: 'p1', porcentajeItbis: 18 }] as never);
      repository.crearDevolucionEnTx.mockResolvedValue({ id: 'dev-1' } as never);
      repository.buscarPorIdEnTx.mockResolvedValue({ lineas: [{ productoId: 'p1', cantidad: 10, cantidadRecibida: 6 }] } as never);

      await service.devolver('oc-1', { ...dtoDevolucion, lineas: [{ productoId: 'p1', cantidad: 4, loteId: 'lote-x' }] }, 'user-1', 'tenant-1');

      expect(inventarioService.verificarYDescontarStockEnTx).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ referenciaTipo: 'DEVOLUCION_COMPRA', referenciaId: 'dev-1', loteId: 'lote-x' }),
      );
    });

    it('un producto SERVICIO no descuenta stock al devolverse (nunca entró a Stock al recibirse)', async () => {
      const ordenConServicio = {
        id: 'oc-1',
        numero: 'OC-001',
        proveedorId: 'prov-1',
        lineas: [{ id: 'linea-1', productoId: 'p1', cantidad: 10, cantidadRecibida: 10, costoUnitario: 20, producto: { tipo: 'SERVICIO' } }],
      };
      repository.buscarPorId.mockResolvedValue(ordenConServicio as never);
      tenantPrisma.client.producto.findMany.mockResolvedValue([{ id: 'p1', porcentajeItbis: 18 }] as never);
      repository.crearDevolucionEnTx.mockResolvedValue({ id: 'dev-1' } as never);
      repository.buscarPorIdEnTx.mockResolvedValue({
        lineas: [{ productoId: 'p1', cantidad: 10, cantidadRecibida: 6 }],
      } as never);

      await service.devolver('oc-1', dtoDevolucion, 'user-1', 'tenant-1');

      expect(inventarioService.verificarYDescontarStockEnTx).not.toHaveBeenCalled();
      expect(repository.actualizarCantidadRecibida).toHaveBeenCalledWith(TX, 'linea-1', -4);
    });

    it('rechaza devolver más cantidad de la que se recibió', async () => {
      repository.buscarPorId.mockResolvedValue(ordenRecibida() as never);
      tenantPrisma.client.producto.findMany.mockResolvedValue([{ id: 'p1', porcentajeItbis: 18 }] as never);

      await expect(
        service.devolver('oc-1', { ...dtoDevolucion, lineas: [{ productoId: 'p1', cantidad: 99 }] }, 'user-1', 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.crearDevolucionEnTx).not.toHaveBeenCalled();
    });

    it('emite ORDEN_COMPRA_DEVUELTA con el monto e itbis de las líneas devueltas', async () => {
      repository.buscarPorId.mockResolvedValue(ordenRecibida() as never);
      tenantPrisma.client.producto.findMany.mockResolvedValue([{ id: 'p1', porcentajeItbis: 18 }] as never);
      repository.crearDevolucionEnTx.mockResolvedValue({ id: 'dev-1' } as never);
      repository.buscarPorIdEnTx.mockResolvedValue({
        lineas: [{ productoId: 'p1', cantidad: 10, cantidadRecibida: 6 }],
      } as never);

      await service.devolver('oc-1', dtoDevolucion, 'user-1', 'tenant-1');

      // 4 unidades * 20 costo = 80; itbis 18% de 80 = 14.4
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.ORDEN_COMPRA_DEVUELTA,
        expect.objectContaining({ tenantId: 'tenant-1', ordenCompraId: 'oc-1', devolucionId: 'dev-1', proveedorId: 'prov-1', monto: '80' }),
      );
      const [, payload] = eventBus.emit.mock.calls.find(([evento]) => evento === EVENTOS.ORDEN_COMPRA_DEVUELTA)!;
      expect(Number((payload as { itbis: string }).itbis)).toBeCloseTo(14.4, 5);
    });
  });
});
