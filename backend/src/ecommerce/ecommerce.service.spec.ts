import { BadRequestException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EcommerceService } from './ecommerce.service';
import { EcommerceRepository } from './ecommerce.repository';
import { PedidosTiendaRepository } from './pedidos-tienda.repository';
import { SeccionesTiendaRepository } from './secciones-tienda.repository';
import { DominiosTiendaRepository } from './dominios-tienda.repository';
import { ClientesService } from '../clientes/clientes.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { VariantesService } from '../variantes/variantes.service';
import { OfertasService } from '../ofertas/ofertas.service';
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
  let seccionesTiendaRepository: jest.Mocked<SeccionesTiendaRepository>;
  let dominiosTiendaRepository: jest.Mocked<DominiosTiendaRepository>;
  let clientesService: jest.Mocked<ClientesService>;
  let facturacionService: jest.Mocked<FacturacionService>;
  let variantesService: jest.Mocked<VariantesService>;
  let ofertasService: jest.Mocked<OfertasService>;
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
      categoriasPublicas: jest.fn().mockResolvedValue([]),
      seccionesActivasPublicas: jest.fn().mockResolvedValue([]),
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
      obtenerCarrito: jest.fn().mockResolvedValue(null),
      guardarCarrito: jest.fn().mockResolvedValue({ id: 'cc1' }),
      misDirecciones: jest.fn().mockResolvedValue([]),
      buscarDireccion: jest.fn().mockResolvedValue(null),
      crearDireccion: jest.fn().mockResolvedValue({ id: 'd1' }),
      actualizarDireccion: jest.fn().mockResolvedValue({ id: 'd1' }),
      eliminarDireccion: jest.fn().mockResolvedValue({ id: 'd1' }),
    } as unknown as jest.Mocked<EcommerceRepository>;
    pedidosTiendaRepository = {
      listar: jest.fn().mockResolvedValue([[], 0]),
      facturasPorIds: jest.fn().mockResolvedValue([]),
      detalle: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<PedidosTiendaRepository>;
    seccionesTiendaRepository = {
      listar: jest.fn().mockResolvedValue([]),
      buscarPorId: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn().mockResolvedValue({ id: 's1' }),
      reordenar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SeccionesTiendaRepository>;
    dominiosTiendaRepository = {
      listarActivos: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DominiosTiendaRepository>;
    clientesService = {
      buscarConsumidorFinal: jest.fn().mockResolvedValue(CONSUMIDOR_FINAL),
    } as unknown as jest.Mocked<ClientesService>;
    facturacionService = {
      crear: jest.fn().mockResolvedValue(FACTURA_CREADA),
    } as unknown as jest.Mocked<FacturacionService>;
    variantesService = {
      listarPorProducto: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<VariantesService>;
    ofertasService = {
      resolverOfertaVisibleProducto: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<OfertasService>;
    jwtService = {
      verify: jest.fn(),
      sign: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    service = new EcommerceService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      ecommerceRepository,
      pedidosTiendaRepository,
      seccionesTiendaRepository,
      dominiosTiendaRepository,
      clientesService,
      facturacionService,
      variantesService,
      ofertasService,
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

      expect(resultado.variantes).toEqual([{ id: 'v1', etiqueta: 'Talla: M', precio: 500, stock: 5, oferta: null }]);
    });

    it('Fase 16 — sin categoría, igual pide relacionados (con categoriaId null) para que el repositorio pueda rellenar con otros productos', async () => {
      ecommerceRepository.buscarProductoPublico.mockResolvedValue({ id: 'p1', nombre: 'Camisa', imagenesAdicionales: [], categoria: null } as never);

      const resultado = await service.producto('demo', 'p1', requestFalso());

      expect(ecommerceRepository.productosRelacionados).toHaveBeenCalledWith({
        tenantId: 't1',
        categoriaId: null,
        excluirProductoId: 'p1',
        bodegaId: 'b1',
        limit: 4,
      });
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
      expect(resultado.relacionados).toEqual([{ id: 'p2', nombre: 'Camisa azul', oferta: null }]);
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

  describe('categorias', () => {
    it('Fase 12 — resuelve la tienda y delega en el repositorio las categorías con productos visibles del tenant', async () => {
      ecommerceRepository.categoriasPublicas.mockResolvedValue([{ id: 'c1', nombre: 'Ropa', cantidad: 5 }] as never);

      const resultado = await service.categorias('demo');

      expect(ecommerceRepository.categoriasPublicas).toHaveBeenCalledWith('t1');
      expect(resultado).toEqual([{ id: 'c1', nombre: 'Ropa', cantidad: 5 }]);
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

  describe('detallePedidoAdmin', () => {
    it('404 si el pedido no existe (o es de otro tenant — el repositorio ya lo filtra)', async () => {
      await expect(service.detallePedidoAdmin('f-ajena')).rejects.toThrow(NotFoundException);
    });

    it('devuelve el detalle cuando la factura existe', async () => {
      const detalle = { factura: { id: 'f1' }, pedido: null, lineas: [{ nombre: 'Producto X', cantidad: 1, precioUnitario: 100, montoTotal: 100 }] };
      pedidosTiendaRepository.detalle.mockResolvedValue(detalle as never);
      await expect(service.detallePedidoAdmin('f1')).resolves.toEqual(detalle);
      expect(pedidosTiendaRepository.detalle).toHaveBeenCalledWith('f1');
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

  describe('obtenerCarrito / guardarCarrito (Fase 16 — carrito persistente del cliente logueado)', () => {
    it('obtenerCarrito: sin fila guardada, devuelve items vacío', async () => {
      const resultado = await service.obtenerCarrito('demo', CLIENTE);
      expect(resultado).toEqual({ items: [] });
    });

    it('obtenerCarrito: parsea el JSON guardado', async () => {
      ecommerceRepository.obtenerCarrito.mockResolvedValue({ itemsJson: JSON.stringify([{ varianteId: 'v1', cantidad: 2 }]) } as never);
      const resultado = await service.obtenerCarrito('demo', CLIENTE);
      expect(resultado).toEqual({ items: [{ varianteId: 'v1', cantidad: 2 }] });
    });

    it('obtenerCarrito: JSON corrupto cae a items vacío sin lanzar', async () => {
      ecommerceRepository.obtenerCarrito.mockResolvedValue({ itemsJson: '{esto no es json' } as never);
      await expect(service.obtenerCarrito('demo', CLIENTE)).resolves.toEqual({ items: [] });
    });

    it('obtenerCarrito: rechaza si el token es de OTRO tenant', async () => {
      await expect(service.obtenerCarrito('demo', { ...CLIENTE, tenantId: 'otro-tenant' })).rejects.toThrow(UnauthorizedException);
      expect(ecommerceRepository.obtenerCarrito).not.toHaveBeenCalled();
    });

    it('guardarCarrito: guarda el JSON serializado bajo el clienteId', async () => {
      const items = [{ productoId: 'p1', varianteId: 'v1', nombre: 'X', varianteEtiqueta: '', precio: 100, imagen: null, cantidad: 1 }];
      await service.guardarCarrito('demo', CLIENTE, { items } as never);
      expect(ecommerceRepository.guardarCarrito).toHaveBeenCalledWith('c1', JSON.stringify(items));
    });

    it('guardarCarrito: rechaza si el token es de OTRO tenant', async () => {
      await expect(service.guardarCarrito('demo', { ...CLIENTE, tenantId: 'otro-tenant' }, { items: [] } as never)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(ecommerceRepository.guardarCarrito).not.toHaveBeenCalled();
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

  describe('secciones (Fase 17, Secciones Dinámicas)', () => {
    it('secciones(): resuelve la tienda pública y adjunta ofertas a los productos de cada sección', async () => {
      ecommerceRepository.seccionesActivasPublicas.mockResolvedValue([
        { id: 's1', tipo: 'PRODUCTOS', titulo: 'Combinalo con...', productos: [{ id: 'p1', precio: 100, categoria: null }] },
      ] as never);
      const resultado = await service.secciones('demo', requestFalso());
      expect(ecommerceRepository.seccionesActivasPublicas).toHaveBeenCalledWith('t1', 'b1');
      expect(resultado[0].productos[0]).toMatchObject({ id: 'p1', oferta: null });
    });

    describe('crearSeccion — validarTipoSeccion', () => {
      it('PRODUCTOS sin productoIds: rechaza', async () => {
        await expect(service.crearSeccion({ tipo: 'PRODUCTOS', titulo: 'X' } as never, 't1')).rejects.toThrow(BadRequestException);
        expect(seccionesTiendaRepository.crear).not.toHaveBeenCalled();
      });

      it('BANNER con productoIds: crea (misma validación que PRODUCTOS)', async () => {
        await service.crearSeccion({ tipo: 'BANNER', titulo: 'X', productoIds: ['p1'] } as never, 't1');
        expect(seccionesTiendaRepository.crear).toHaveBeenCalledWith('t1', { tipo: 'BANNER', titulo: 'X', productoIds: ['p1'] });
      });

      it('CATEGORIA sin categoriaId: rechaza', async () => {
        await expect(service.crearSeccion({ tipo: 'CATEGORIA', titulo: 'X' } as never, 't1')).rejects.toThrow(BadRequestException);
      });

      it('MINIGRID con 1 sola categoría: rechaza (mínimo 2)', async () => {
        await expect(service.crearSeccion({ tipo: 'MINIGRID', titulo: 'X', categoriaIds: ['c1'] } as never, 't1')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('MINIGRID con 4 categorías: crea', async () => {
        const categoriaIds = ['c1', 'c2', 'c3', 'c4'];
        await service.crearSeccion({ tipo: 'MINIGRID', titulo: 'X', categoriaIds } as never, 't1');
        expect(seccionesTiendaRepository.crear).toHaveBeenCalledWith('t1', { tipo: 'MINIGRID', titulo: 'X', categoriaIds });
      });
    });

    describe('actualizarSeccion — combina con lo ya guardado antes de revalidar', () => {
      it('cambiar a CATEGORIA sin mandar categoriaId, y la sección actual tampoco tenía uno: rechaza', async () => {
        seccionesTiendaRepository.buscarPorId.mockResolvedValue({
          id: 's1',
          tipo: 'PRODUCTOS',
          titulo: 'X',
          categoriaId: null,
          productos: [{ productoId: 'p1' }],
          categorias: [],
        } as never);
        await expect(service.actualizarSeccion('s1', { tipo: 'CATEGORIA' })).rejects.toThrow(BadRequestException);
        expect(seccionesTiendaRepository.actualizar).not.toHaveBeenCalled();
      });

      it('PATCH que solo cambia el título no toca la validación de tipo (usa los productos ya guardados)', async () => {
        seccionesTiendaRepository.buscarPorId.mockResolvedValue({
          id: 's1',
          tipo: 'PRODUCTOS',
          titulo: 'Viejo',
          categoriaId: null,
          productos: [{ productoId: 'p1' }],
          categorias: [],
        } as never);
        await service.actualizarSeccion('s1', { titulo: 'Nuevo' });
        expect(seccionesTiendaRepository.actualizar).toHaveBeenCalledWith('s1', { titulo: 'Nuevo' });
      });
    });

    it('reordenarSecciones: delega el arreglo completo de ids al repositorio', async () => {
      await service.reordenarSecciones({ ids: ['s2', 's1'] });
      expect(seccionesTiendaRepository.reordenar).toHaveBeenCalledWith(['s2', 's1']);
    });
  });
});
