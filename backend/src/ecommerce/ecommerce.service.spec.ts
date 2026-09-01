import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EcommerceService } from './ecommerce.service';
import { EcommerceRepository } from './ecommerce.repository';
import { PedidosTiendaRepository } from './pedidos-tienda.repository';
import { ClientesService } from '../clientes/clientes.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { AuthenticatedRequest } from '../common/types/authenticated-request';

const TENANT_ACTIVO = { id: 't1', nombre: 'Tenant Demo', estado: 'ACTIVO' };
const VENDEDOR = { id: 'u1' };
const CONSUMIDOR_FINAL = { id: 'cf1' };
const FACTURA_CREADA = { id: 'f1', total: 100 };

function requestFalso(): AuthenticatedRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {} as any;
}

describe('EcommerceService', () => {
  let service: EcommerceService;
  let prisma: {
    tenant: { findUnique: jest.Mock };
    tenantModuloOverride: { findFirst: jest.Mock };
    configuracion: { findMany: jest.Mock };
  };
  let ecommerceRepository: jest.Mocked<EcommerceRepository>;
  let pedidosTiendaRepository: jest.Mocked<PedidosTiendaRepository>;
  let clientesService: jest.Mocked<ClientesService>;
  let facturacionService: jest.Mocked<FacturacionService>;

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ ...TENANT_ACTIVO, plan: { modulos: [{ modulo: { clave: 'ecommerce' } }] } }) },
      tenantModuloOverride: { findFirst: jest.fn().mockResolvedValue(null) },
      configuracion: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'TIENDA_ACTIVA', valor: 'true' },
          { clave: 'TIENDA_PLANTILLA', valor: 'MERCADO' },
          { clave: 'TIENDA_BODEGA_ID', valor: 'b1' },
        ]),
      },
    };
    ecommerceRepository = {
      buscarTenantPorSubdominio: jest.fn().mockResolvedValue(TENANT_ACTIVO),
      catalogo: jest.fn().mockResolvedValue([[], 0]),
      buscarProductoPublico: jest.fn().mockResolvedValue(null),
      buscarAdminMasAntiguo: jest.fn().mockResolvedValue(VENDEDOR),
      crearPedido: jest.fn().mockResolvedValue({ id: 'pt1' }),
    } as unknown as jest.Mocked<EcommerceRepository>;
    pedidosTiendaRepository = {
      listar: jest.fn().mockResolvedValue([[], 0]),
      facturasPorIds: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PedidosTiendaRepository>;
    clientesService = {
      buscarConsumidorFinal: jest.fn().mockResolvedValue(CONSUMIDOR_FINAL),
    } as unknown as jest.Mocked<ClientesService>;
    facturacionService = {
      crear: jest.fn().mockResolvedValue(FACTURA_CREADA),
    } as unknown as jest.Mocked<FacturacionService>;

    service = new EcommerceService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      ecommerceRepository,
      pedidosTiendaRepository,
      clientesService,
      facturacionService,
    );
  });

  describe('resolverTiendaPublica', () => {
    it('404 si el tenant no existe', async () => {
      ecommerceRepository.buscarTenantPorSubdominio.mockResolvedValue(null);
      await expect(service.resolverTiendaPublica('inexistente')).rejects.toThrow(NotFoundException);
    });

    it('404 si el tenant no está ACTIVO (suspendido/cancelado)', async () => {
      ecommerceRepository.buscarTenantPorSubdominio.mockResolvedValue({ ...TENANT_ACTIVO, estado: 'SUSPENDIDO' } as never);
      await expect(service.resolverTiendaPublica('demo')).rejects.toThrow(NotFoundException);
    });

    it('404 si el tenant no tiene el módulo "ecommerce" activo', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ ...TENANT_ACTIVO, plan: { modulos: [] } });
      await expect(service.resolverTiendaPublica('demo')).rejects.toThrow(NotFoundException);
    });

    it('404 si el módulo está activo pero la tienda no fue activada en su configuración', async () => {
      prisma.configuracion.findMany.mockResolvedValue([{ clave: 'TIENDA_ACTIVA', valor: 'false' }]);
      await expect(service.resolverTiendaPublica('demo')).rejects.toThrow(NotFoundException);
    });

    it('resuelve tenant + config cuando todo está en orden', async () => {
      const resultado = await service.resolverTiendaPublica('demo');
      expect(resultado.tenant.id).toBe('t1');
      expect(resultado.config.activa).toBe(true);
      expect(resultado.config.plantilla).toBe('MERCADO');
    });
  });

  describe('obtenerConfig', () => {
    it('usa el nombre del tenant si TIENDA_NOMBRE no está configurado', async () => {
      const config = await service.obtenerConfig('demo');
      expect(config.nombre).toBe('Tenant Demo');
      expect(config.plantilla).toBe('MERCADO');
    });
  });

  describe('producto', () => {
    it('404 si el producto no existe o no es visible en la tienda', async () => {
      await expect(service.producto('demo', 'p1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('crearPedido', () => {
    const DTO = {
      lineas: [{ productoId: 'p1', cantidad: 2 }],
      clienteNombre: 'Juan Pérez',
      clienteTelefono: '8095551234',
      direccionEntrega: 'Calle Falsa 123',
    };

    it('crea la Factura (sin pagos, sin comprobanteFiscal forzado) y el PedidoTienda, y devuelve el facturaId', async () => {
      const resultado = await service.crearPedido('demo', DTO, requestFalso());

      expect(facturacionService.crear).toHaveBeenCalledWith(
        expect.objectContaining({ clienteId: 'cf1', bodegaId: 'b1', tipoFactura: 'CONTADO' }),
        't1',
        'u1',
      );
      expect(ecommerceRepository.crearPedido).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', facturaId: 'f1', clienteNombre: 'Juan Pérez' }),
      );
      expect(resultado).toEqual({ facturaId: 'f1' });
    });

    it('nunca manda precioUnitario en las líneas — siempre se resuelve del catálogo real', async () => {
      await service.crearPedido('demo', DTO, requestFalso());
      const [facturaDto] = facturacionService.crear.mock.calls[0];
      expect(facturaDto.lineas[0]).not.toHaveProperty('precioUnitario');
    });

    it('rechaza si la tienda no tiene bodega configurada', async () => {
      prisma.configuracion.findMany.mockResolvedValue([{ clave: 'TIENDA_ACTIVA', valor: 'true' }]);
      await expect(service.crearPedido('demo', DTO, requestFalso())).rejects.toThrow(ServiceUnavailableException);
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });

    it('rechaza si el tenant no tiene ningún Admin Total (sin vendedor a quien atribuir el pedido)', async () => {
      ecommerceRepository.buscarAdminMasAntiguo.mockResolvedValue(null);
      await expect(service.crearPedido('demo', DTO, requestFalso())).rejects.toThrow(ServiceUnavailableException);
    });

    it('rechaza si el tenant no tiene Consumidor Final sembrado', async () => {
      clientesService.buscarConsumidorFinal.mockResolvedValue(null);
      await expect(service.crearPedido('demo', DTO, requestFalso())).rejects.toThrow(ServiceUnavailableException);
      expect(facturacionService.crear).not.toHaveBeenCalled();
    });
  });

  describe('listarPedidos', () => {
    it('junta cada PedidoTienda con su Factura correspondiente', async () => {
      pedidosTiendaRepository.listar.mockResolvedValue([[{ id: 'pt1', facturaId: 'f1' }], 1] as never);
      pedidosTiendaRepository.facturasPorIds.mockResolvedValue([{ id: 'f1', numero: '000001', estado: 'EMITIDA', pagada: false }] as never);

      const resultado = await service.listarPedidos({});

      expect(resultado.datos[0].factura).toEqual(expect.objectContaining({ id: 'f1', numero: '000001' }));
      expect(resultado.total).toBe(1);
    });
  });
});
