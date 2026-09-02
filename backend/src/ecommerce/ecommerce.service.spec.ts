import { NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EcommerceService } from './ecommerce.service';
import { EcommerceRepository } from './ecommerce.repository';
import { PedidosTiendaRepository } from './pedidos-tienda.repository';
import { ClientesService } from '../clientes/clientes.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { VariantesService } from '../variantes/variantes.service';
import { AuthenticatedRequest } from '../common/types/authenticated-request';

const TENANT_ACTIVO = { id: 't1', nombre: 'Tenant Demo', estado: 'ACTIVO', plan: { modulos: [{ modulo: { clave: 'ecommerce' } }] } };
const VENDEDOR = { id: 'u1' };
const CONSUMIDOR_FINAL = { id: 'cf1' };
const FACTURA_CREADA = { id: 'f1', total: 100 };

function requestFalso(authorization?: string): AuthenticatedRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { headers: { authorization } } as any;
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
  let variantesService: jest.Mocked<VariantesService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue(TENANT_ACTIVO) },
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
      catalogo: jest.fn().mockResolvedValue([[], 0]),
      ofertasVigentesPublicas: jest.fn().mockResolvedValue([]),
      productosRelacionados: jest.fn().mockResolvedValue([]),
      buscarProductoPublico: jest.fn().mockResolvedValue(null),
      buscarAdminMasAntiguo: jest.fn().mockResolvedValue(VENDEDOR),
      crearPedido: jest.fn().mockResolvedValue({ id: 'pt1' }),
      preciosPorVariantes: jest.fn().mockResolvedValue([]),
      misPedidos: jest.fn().mockResolvedValue([]),
      detallePedido: jest.fn().mockResolvedValue(null),
      miPerfil: jest.fn().mockResolvedValue({ id: 'c1', nombre: 'Ana', email: 'ana@ejemplo.com', telefono: null, puntosLealtad: 0 }),
      actualizarPerfil: jest.fn().mockResolvedValue({ id: 'c1', nombre: 'Ana', email: 'ana@ejemplo.com', telefono: null, puntosLealtad: 0 }),
      buscarClientePorEmail: jest.fn().mockResolvedValue(null),
      misDirecciones: jest.fn().mockResolvedValue([]),
      buscarDireccion: jest.fn().mockResolvedValue(null),
      crearDireccion: jest.fn().mockResolvedValue({ id: 'd1' }),
      actualizarDireccion: jest.fn().mockResolvedValue({ id: 'd1' }),
      eliminarDireccion: jest.fn().mockResolvedValue({ id: 'd1' }),
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
    variantesService = {
      listarPorProducto: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<VariantesService>;
    jwtService = {
      verify: jest.fn(),
      sign: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    service = new EcommerceService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      ecommerceRepository,
      pedidosTiendaRepository,
      clientesService,
      facturacionService,
      variantesService,
      jwtService,
    );
  });

  describe('resolverTiendaPublica', () => {
    it('404 si el tenant no existe', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.resolverTiendaPublica('inexistente')).rejects.toThrow(NotFoundException);
    });

    it('404 si el tenant no está ACTIVO (suspendido/cancelado)', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ ...TENANT_ACTIVO, estado: 'SUSPENDIDO' });
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
      await expect(service.producto('demo', 'p1', requestFalso())).rejects.toThrow(NotFoundException);
    });

    it('devuelve solo las variantes activas, con etiqueta/precio/stock resueltos (Fase 4)', async () => {
      ecommerceRepository.buscarProductoPublico.mockResolvedValue({ id: 'p1', nombre: 'Camisa', imagenesAdicionales: [] } as never);
      variantesService.listarPorProducto.mockResolvedValue([
        {
          id: 'v1',
          activa: true,
          existencia: 5,
          valoresAtributo: [{ valorAtributo: { valor: 'M', atributo: { nombre: 'Talla' } } }],
        },
        {
          id: 'v2',
          activa: false,
          existencia: 3,
          valoresAtributo: [{ valorAtributo: { valor: 'L', atributo: { nombre: 'Talla' } } }],
        },
      ] as never);
      ecommerceRepository.preciosPorVariantes.mockResolvedValue([{ varianteId: 'v1', precioVenta: 500 }] as never);

      const resultado = await service.producto('demo', 'p1', requestFalso());

      expect(resultado.variantes).toEqual([{ id: 'v1', etiqueta: 'Talla: M', precio: 500, stock: 5 }]);
    });

    it('Fase 11 — sin categoría, no busca relacionados y devuelve la lista vacía', async () => {
      ecommerceRepository.buscarProductoPublico.mockResolvedValue({ id: 'p1', nombre: 'Camisa', imagenesAdicionales: [], categoria: null } as never);

      const resultado = await service.producto('demo', 'p1', requestFalso());

      expect(ecommerceRepository.productosRelacionados).not.toHaveBeenCalled();
      expect(resultado.relacionados).toEqual([]);
    });

    it('Fase 11 — con categoría, pide relacionados de la MISMA categoría excluyendo el propio producto', async () => {
      ecommerceRepository.buscarProductoPublico.mockResolvedValue({
        id: 'p1',
        nombre: 'Camisa',
        imagenesAdicionales: [],
        categoria: { id: 'cat1', nombre: 'Camisas' },
      } as never);
      ecommerceRepository.productosRelacionados.mockResolvedValue([{ id: 'p2', nombre: 'Camisa azul' }] as never);

      const resultado = await service.producto('demo', 'p1', requestFalso());

      expect(ecommerceRepository.productosRelacionados).toHaveBeenCalledWith({
        tenantId: 't1',
        categoriaId: 'cat1',
        excluirProductoId: 'p1',
        bodegaId: 'b1',
        limit: 4,
      });
      expect(resultado.relacionados).toEqual([{ id: 'p2', nombre: 'Camisa azul' }]);
    });
  });

  describe('ofertas', () => {
    it('Fase 11 — resuelve la tienda y delega en el repositorio las ofertas vigentes del tenant', async () => {
      ecommerceRepository.ofertasVigentesPublicas.mockResolvedValue([{ id: 'o1', nombre: '20% en Camisas' }] as never);

      const resultado = await service.ofertas('demo');

      expect(ecommerceRepository.ofertasVigentesPublicas).toHaveBeenCalledWith('t1');
      expect(resultado).toEqual([{ id: 'o1', nombre: '20% en Camisas' }]);
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

    it('Fase 6 — usa el clienteId del token de sesión en vez de Consumidor Final cuando es válido y del mismo tenant', async () => {
      jwtService.verify.mockReturnValue({ clienteId: 'cliente-real', tenantId: 't1', email: 'a@a.com' });

      await service.crearPedido('demo', DTO, requestFalso('Bearer token-valido'));

      expect(jwtService.verify).toHaveBeenCalledWith('token-valido', expect.objectContaining({ secret: expect.any(String) }));
      expect(facturacionService.crear).toHaveBeenCalledWith(expect.objectContaining({ clienteId: 'cliente-real' }), 't1', 'u1');
      expect(clientesService.buscarConsumidorFinal).not.toHaveBeenCalled();
    });

    it('Fase 6 — cae a Consumidor Final si el token es de OTRO tenant', async () => {
      jwtService.verify.mockReturnValue({ clienteId: 'cliente-ajeno', tenantId: 'otro-tenant', email: 'a@a.com' });

      await service.crearPedido('demo', DTO, requestFalso('Bearer token-de-otro-tenant'));

      expect(facturacionService.crear).toHaveBeenCalledWith(expect.objectContaining({ clienteId: 'cf1' }), 't1', 'u1');
    });

    it('Fase 6 — cae a Consumidor Final si el token es inválido/vencido, sin romper el checkout guest', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await service.crearPedido('demo', DTO, requestFalso('Bearer token-vencido'));

      expect(facturacionService.crear).toHaveBeenCalledWith(expect.objectContaining({ clienteId: 'cf1' }), 't1', 'u1');
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

  describe('misPedidos', () => {
    it('devuelve los pedidos del cliente autenticado cuando el subdominio corresponde a su tenant', async () => {
      ecommerceRepository.misPedidos.mockResolvedValue([{ factura: { id: 'f1' }, pedido: null }] as never);

      const resultado = await service.misPedidos('demo', { clienteId: 'c1', tenantId: 't1', email: 'a@a.com' });

      expect(ecommerceRepository.misPedidos).toHaveBeenCalledWith('t1', 'c1');
      expect(resultado).toEqual([{ factura: { id: 'f1' }, pedido: null }]);
    });

    it('rechaza si el token es de un tenant distinto al del subdominio pedido', async () => {
      await expect(service.misPedidos('demo', { clienteId: 'c1', tenantId: 'otro-tenant', email: 'a@a.com' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(ecommerceRepository.misPedidos).not.toHaveBeenCalled();
    });
  });

  const CLIENTE = { clienteId: 'c1', tenantId: 't1', email: 'ana@ejemplo.com' };

  describe('detallePedido', () => {
    it('404 si la factura no existe o no pertenece a este tenant+cliente (el repositorio ya filtra por ambos)', async () => {
      ecommerceRepository.detallePedido.mockResolvedValue(null);
      await expect(service.detallePedido('demo', CLIENTE, 'f-ajena')).rejects.toThrow(NotFoundException);
    });

    it('devuelve el detalle cuando la factura sí pertenece al cliente', async () => {
      const detalle = { factura: { id: 'f1' }, pedido: null, lineas: [{ nombre: 'Producto X', cantidad: 1, precioUnitario: 100, montoTotal: 100 }] };
      ecommerceRepository.detallePedido.mockResolvedValue(detalle as never);
      await expect(service.detallePedido('demo', CLIENTE, 'f1')).resolves.toEqual(detalle);
      expect(ecommerceRepository.detallePedido).toHaveBeenCalledWith('t1', 'c1', 'f1');
    });
  });

  describe('actualizarPerfil', () => {
    it('rechaza el email si ya lo usa OTRA cuenta con contraseña de este tenant', async () => {
      ecommerceRepository.buscarClientePorEmail.mockResolvedValue({ id: 'otro-cliente' } as never);
      await expect(service.actualizarPerfil('demo', CLIENTE, { email: 'ya-usado@ejemplo.com' })).rejects.toThrow();
      expect(ecommerceRepository.actualizarPerfil).not.toHaveBeenCalled();
    });

    it('permite conservar el propio email (el "existente" encontrado es uno mismo)', async () => {
      ecommerceRepository.buscarClientePorEmail.mockResolvedValue({ id: 'c1' } as never);
      await expect(service.actualizarPerfil('demo', CLIENTE, { email: 'ana@ejemplo.com', nombre: 'Ana T.' })).resolves.toBeDefined();
      expect(ecommerceRepository.actualizarPerfil).toHaveBeenCalledWith('c1', { email: 'ana@ejemplo.com', nombre: 'Ana T.' });
    });
  });

  describe('direcciones — IDOR', () => {
    it('actualizarDireccion: 404 si la dirección no existe', async () => {
      ecommerceRepository.buscarDireccion.mockResolvedValue(null);
      await expect(service.actualizarDireccion('demo', CLIENTE, 'd-inexistente', { ciudad: 'Santiago' })).rejects.toThrow(NotFoundException);
      expect(ecommerceRepository.actualizarDireccion).not.toHaveBeenCalled();
    });

    it('actualizarDireccion: 404 si la dirección pertenece a OTRO cliente', async () => {
      ecommerceRepository.buscarDireccion.mockResolvedValue({ id: 'd1', clienteId: 'otro-cliente' } as never);
      await expect(service.actualizarDireccion('demo', CLIENTE, 'd1', { ciudad: 'Santiago' })).rejects.toThrow(NotFoundException);
      expect(ecommerceRepository.actualizarDireccion).not.toHaveBeenCalled();
    });

    it('eliminarDireccion: 404 si la dirección pertenece a OTRO cliente', async () => {
      ecommerceRepository.buscarDireccion.mockResolvedValue({ id: 'd1', clienteId: 'otro-cliente' } as never);
      await expect(service.eliminarDireccion('demo', CLIENTE, 'd1')).rejects.toThrow(NotFoundException);
      expect(ecommerceRepository.eliminarDireccion).not.toHaveBeenCalled();
    });

    it('actualizarDireccion: procede cuando la dirección sí es del cliente autenticado', async () => {
      ecommerceRepository.buscarDireccion.mockResolvedValue({ id: 'd1', clienteId: 'c1' } as never);
      await expect(service.actualizarDireccion('demo', CLIENTE, 'd1', { esPrincipal: true })).resolves.toBeDefined();
      expect(ecommerceRepository.actualizarDireccion).toHaveBeenCalledWith('d1', 'c1', { esPrincipal: true });
    });
  });
});
