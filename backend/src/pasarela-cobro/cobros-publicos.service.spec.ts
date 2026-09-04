import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CobrosPublicosService } from './cobros-publicos.service';
import { SesionesCobroRepository } from './sesiones-cobro.repository';
import { AzulAdapter } from './adapters/azul.adapter';
import { CardNetAdapter } from './adapters/cardnet.adapter';
import { FacturacionService } from '../facturacion/facturacion.service';
import { AuthenticatedRequest } from '../common/types/authenticated-request';

const FACTURA_BASE = {
  id: 'f1',
  tenantId: 't1',
  ncf: 'B0200000001',
  estado: 'EMITIDA',
  pagada: false,
  subtotal: 900 as unknown,
  itbis: 100 as unknown,
  total: 1000 as unknown,
  tenant: { nombre: 'Tenant Demo' },
  lineas: [] as unknown[],
};

const CONFIG_BASE = {
  id: 'p1',
  tenantId: 't1',
  pasarelaActiva: 'AZUL',
};

const SESION_BASE = {
  id: 's1',
  tenantId: 't1',
  facturaId: 'f1',
  pasarela: 'AZUL',
  referenciaExterna: 'orden-1',
  monto: 500 as unknown,
  estado: 'PENDIENTE',
  pagoId: null,
};

describe('CobrosPublicosService', () => {
  let service: CobrosPublicosService;
  let prisma: {
    factura: { findUnique: jest.Mock };
    pago: { aggregate: jest.Mock };
    pasarelaConfigTenant: { findUnique: jest.Mock };
    formaPago: { findFirst: jest.Mock };
    pedidoTienda: { findUnique: jest.Mock };
  };
  let sesionesCobroRepository: jest.Mocked<SesionesCobroRepository>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let azulAdapter: jest.Mocked<AzulAdapter>;
  let cardNetAdapter: jest.Mocked<CardNetAdapter>;

  beforeEach(() => {
    prisma = {
      factura: { findUnique: jest.fn().mockResolvedValue(FACTURA_BASE) },
      pago: { aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }) },
      pasarelaConfigTenant: { findUnique: jest.fn().mockResolvedValue(CONFIG_BASE) },
      formaPago: { findFirst: jest.fn().mockResolvedValue({ id: 'fp-tarjeta' }) },
      pedidoTienda: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    sesionesCobroRepository = {
      crear: jest.fn().mockResolvedValue(SESION_BASE),
      buscarPorReferencia: jest.fn().mockResolvedValue(SESION_BASE),
      intentarResolver: jest.fn().mockResolvedValue(true),
      marcarRechazada: jest.fn(),
      vincularPago: jest.fn(),
    } as unknown as jest.Mocked<SesionesCobroRepository>;
    facturacionService = {
      registrarPago: jest.fn().mockResolvedValue({ id: 'pago-1' }),
    } as unknown as jest.Mocked<FacturacionService>;
    azulAdapter = {
      clave: 'AZUL',
      crearCheckout: jest.fn().mockResolvedValue({ metodo: 'POST', url: 'https://azul/pay', campos: { OrderNumber: 'orden-1' }, referenciaExterna: 'orden-1' }),
      verificarRetorno: jest.fn().mockResolvedValue({ aprobado: true }),
    } as unknown as jest.Mocked<AzulAdapter>;
    cardNetAdapter = {
      clave: 'CARDNET',
      crearCheckout: jest.fn().mockResolvedValue({ metodo: 'POST', url: 'https://cardnet/authorize', campos: { SESSION: 'sess-1' }, referenciaExterna: 'ref-1' }),
      verificarRetorno: jest.fn().mockResolvedValue({ aprobado: true }),
    } as unknown as jest.Mocked<CardNetAdapter>;

    service = new CobrosPublicosService(prisma as never, sesionesCobroRepository, facturacionService, azulAdapter, cardNetAdapter);
  });

  describe('obtenerFacturaPublica', () => {
    it('404 si la factura no existe', async () => {
      prisma.factura.findUnique.mockResolvedValue(null);
      await expect(service.obtenerFacturaPublica('inexistente')).rejects.toThrow(NotFoundException);
    });

    it('calcula el pendiente contra los pagos ya registrados', async () => {
      prisma.pago.aggregate.mockResolvedValue({ _sum: { monto: 300 } });
      const resultado = await service.obtenerFacturaPublica('f1');
      expect(resultado.pendiente).toBe(700);
      expect(resultado.pasarelaDisponible).toBe('AZUL');
    });

    it('mapea las líneas con el nombre del producto (o la descripción manual si no tiene producto)', async () => {
      prisma.factura.findUnique.mockResolvedValue({
        ...FACTURA_BASE,
        lineas: [
          { producto: { nombre: 'Camisa' }, descripcionManual: null, cantidad: 2 as unknown, precioUnitario: 100 as unknown, descuento: 0 as unknown, montoTotal: 200 as unknown },
          { producto: null, descripcionManual: 'Instalación', cantidad: 1 as unknown, precioUnitario: 50 as unknown, descuento: 0 as unknown, montoTotal: 50 as unknown },
        ],
      });
      const resultado = await service.obtenerFacturaPublica('f1');
      expect(resultado.lineas).toEqual([
        { nombre: 'Camisa', cantidad: '2', precioUnitario: '100', descuento: '0', montoTotal: '200' },
        { nombre: 'Instalación', cantidad: '1', precioUnitario: '50', descuento: '0', montoTotal: '50' },
      ]);
    });

    it('entrega es null si la factura no vino de un pedido de tienda', async () => {
      const resultado = await service.obtenerFacturaPublica('f1');
      expect(resultado.entrega).toBeNull();
    });

    it('entrega trae los datos del PedidoTienda cuando la factura sí vino de la tienda', async () => {
      prisma.pedidoTienda.findUnique.mockResolvedValue({
        clienteNombre: 'Ana Martínez',
        clienteTelefono: '809-555-0142',
        direccionEntrega: 'Av. Independencia #245, Santo Domingo',
      });
      const resultado = await service.obtenerFacturaPublica('f1');
      expect(resultado.entrega).toEqual({ nombre: 'Ana Martínez', telefono: '809-555-0142', direccion: 'Av. Independencia #245, Santo Domingo' });
    });
  });

  describe('crearCheckout', () => {
    it('rechaza si la factura no está EMITIDA', async () => {
      prisma.factura.findUnique.mockResolvedValue({ ...FACTURA_BASE, estado: 'BORRADOR' });
      await expect(service.crearCheckout('f1', 100)).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la factura ya está pagada', async () => {
      prisma.factura.findUnique.mockResolvedValue({ ...FACTURA_BASE, pagada: true });
      await expect(service.crearCheckout('f1', 100)).rejects.toThrow(BadRequestException);
    });

    it('rechaza un monto que excede el pendiente', async () => {
      await expect(service.crearCheckout('f1', 1000.01)).rejects.toThrow(BadRequestException);
    });

    it('rechaza monto cero o negativo', async () => {
      await expect(service.crearCheckout('f1', 0)).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el tenant no tiene pasarela activa', async () => {
      prisma.pasarelaConfigTenant.findUnique.mockResolvedValue({ ...CONFIG_BASE, pasarelaActiva: null });
      await expect(service.crearCheckout('f1', 100)).rejects.toThrow(ServiceUnavailableException);
    });

    it('permite un pago parcial y guarda la sesión con ese monto', async () => {
      await service.crearCheckout('f1', 400);
      expect(azulAdapter.crearCheckout).toHaveBeenCalledWith(expect.objectContaining({ monto: 400 }));
      expect(sesionesCobroRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ monto: 400, tenantId: 't1' }));
    });

    it('delega en CardNetAdapter cuando esa es la pasarela activa del tenant', async () => {
      prisma.pasarelaConfigTenant.findUnique.mockResolvedValue({ ...CONFIG_BASE, pasarelaActiva: 'CARDNET' });
      await service.crearCheckout('f1', 200);
      expect(cardNetAdapter.crearCheckout).toHaveBeenCalledWith(expect.objectContaining({ monto: 200 }));
      expect(azulAdapter.crearCheckout).not.toHaveBeenCalled();
    });
  });

  describe('procesarRetorno', () => {
    const request = {} as AuthenticatedRequest;

    it('404 si no existe la sesión', async () => {
      sesionesCobroRepository.buscarPorReferencia.mockResolvedValue(null);
      await expect(service.procesarRetorno('AZUL', 'no-existe', {}, request)).rejects.toThrow(NotFoundException);
    });

    it('idempotente: una sesión ya CONFIRMADO no vuelve a llamar a registrarPago', async () => {
      sesionesCobroRepository.buscarPorReferencia.mockResolvedValue({ ...SESION_BASE, estado: 'CONFIRMADO' } as never);
      const resultado = await service.procesarRetorno('AZUL', 'orden-1', {}, request);
      expect(resultado.aprobado).toBe(true);
      expect(facturacionService.registrarPago).not.toHaveBeenCalled();
    });

    it('idempotente: una sesión ya RECHAZADO no vuelve a llamar a registrarPago', async () => {
      sesionesCobroRepository.buscarPorReferencia.mockResolvedValue({ ...SESION_BASE, estado: 'RECHAZADO' } as never);
      const resultado = await service.procesarRetorno('AZUL', 'orden-1', {}, request);
      expect(resultado.aprobado).toBe(false);
      expect(facturacionService.registrarPago).not.toHaveBeenCalled();
    });

    it('marca RECHAZADO y no llama a registrarPago si la verificación falla', async () => {
      azulAdapter.verificarRetorno.mockResolvedValue({ aprobado: false, detalle: 'hash inválido' });
      const resultado = await service.procesarRetorno('AZUL', 'orden-1', {}, request);
      expect(resultado.aprobado).toBe(false);
      expect(sesionesCobroRepository.intentarResolver).toHaveBeenCalledWith('s1', 'RECHAZADO');
      expect(facturacionService.registrarPago).not.toHaveBeenCalled();
    });

    it('registra el pago con userId null cuando la verificación aprueba', async () => {
      const resultado = await service.procesarRetorno('AZUL', 'orden-1', {}, request);
      expect(resultado.aprobado).toBe(true);
      expect(facturacionService.registrarPago).toHaveBeenCalledWith(
        'f1',
        expect.objectContaining({ monto: 500, formaPagoId: 'fp-tarjeta' }),
        null,
        't1',
      );
      expect(sesionesCobroRepository.vincularPago).toHaveBeenCalledWith('s1', 'pago-1');
    });

    it('no duplica el Pago si otra llamada concurrente ya ganó la transición', async () => {
      sesionesCobroRepository.intentarResolver.mockResolvedValue(false);
      const resultado = await service.procesarRetorno('AZUL', 'orden-1', {}, request);
      expect(resultado.aprobado).toBe(true);
      expect(facturacionService.registrarPago).not.toHaveBeenCalled();
    });

    it('si registrarPago falla después de reclamar, revierte la sesión a RECHAZADO', async () => {
      facturacionService.registrarPago.mockRejectedValue(new BadRequestException('saldo cambió'));
      await expect(service.procesarRetorno('AZUL', 'orden-1', {}, request)).rejects.toThrow(BadRequestException);
      expect(sesionesCobroRepository.marcarRechazada).toHaveBeenCalledWith('s1');
    });

    it('CardNet: delega la verificación en CardNetAdapter, no en AzulAdapter', async () => {
      sesionesCobroRepository.buscarPorReferencia.mockResolvedValue({ ...SESION_BASE, pasarela: 'CARDNET', referenciaExterna: 'ref-1' } as never);
      const resultado = await service.procesarRetorno('CARDNET', 'ref-1', {}, request);
      expect(resultado.aprobado).toBe(true);
      expect(cardNetAdapter.verificarRetorno).toHaveBeenCalled();
      expect(azulAdapter.verificarRetorno).not.toHaveBeenCalled();
    });

    it('forja request.user con el tenantId de la sesión, no uno arbitrario', async () => {
      await service.procesarRetorno('AZUL', 'orden-1', {}, request);
      expect(request.user?.tenantId).toBe('t1');
      expect(request.user?.userId).not.toBe('t1');
    });
  });
});
