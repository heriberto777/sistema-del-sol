import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EcommerceRepository } from './ecommerce.repository';
import { PedidosTiendaRepository } from './pedidos-tienda.repository';
import { resolverTiendaPublica } from './resolver-tienda-publica';
import { paginar } from '../common/types/pagina-resultado';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogoTiendaQueryDto } from './dto/catalogo-tienda-query.dto';
import { CrearPedidoTiendaDto } from './dto/crear-pedido-tienda.dto';
import { ActualizarPerfilClienteTiendaDto } from './dto/actualizar-perfil-cliente-tienda.dto';
import { ActualizarDireccionClienteDto, CrearDireccionClienteDto } from './dto/direccion-cliente.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { ClientesService } from '../clientes/clientes.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { VariantesService } from '../variantes/variantes.service';
import { AuthenticatedRequest, JwtPayloadUser } from '../common/types/authenticated-request';
import { CLIENTE_TIENDA_JWT_SECRET } from '../cliente-tienda-auth/cliente-tienda-jwt.constants';
import { ClienteTiendaPayload } from '../cliente-tienda-auth/cliente-tienda-authenticated-request';

@Injectable()
export class EcommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecommerceRepository: EcommerceRepository,
    private readonly pedidosTiendaRepository: PedidosTiendaRepository,
    private readonly clientesService: ClientesService,
    private readonly facturacionService: FacturacionService,
    private readonly variantesService: VariantesService,
    private readonly jwtService: JwtService,
  ) {}

  resolverTiendaPublica(subdominio: string) {
    return resolverTiendaPublica(this.prisma, subdominio);
  }

  async obtenerConfig(subdominio: string) {
    const { tenant, config } = await this.resolverTiendaPublica(subdominio);
    return {
      nombre: config.nombre || tenant.nombre,
      plantilla: config.plantilla,
      logo: config.logo ?? null,
      banner: config.banner ?? null,
      colorAcento: config.colorAcento ?? null,
      tema: config.tema,
      bannerTexto: config.bannerTexto ?? null,
    };
  }

  /** Fase 11 — ofertas vigentes ahora mismo, para la sección "Ofertas" del storefront. */
  async ofertas(subdominio: string) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    return this.ecommerceRepository.ofertasVigentesPublicas(tenant.id);
  }

  async catalogo(subdominio: string, query: CatalogoTiendaQueryDto) {
    const { tenant, config } = await this.resolverTiendaPublica(subdominio);
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.ecommerceRepository.catalogo({
      tenantId: tenant.id,
      bodegaId: config.bodegaId,
      skip,
      take,
      busqueda: query.busqueda,
      categoriaId: query.categoriaId,
      destacado: query.destacado === 'true' ? true : undefined,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  /**
   * `VarianteProducto.activa` (Fase 4) — primer punto del sistema que
   * de verdad lo filtra (hoy no lo usa nadie más, ver
   * VariantesRepository/VariantesProductoPanel: existe en el schema
   * pero nunca se filtró en ningún lado). `request` se forja con el
   * tenant resuelto para reusar `VariantesService.listarPorProducto`
   * (request-scoped vía `TenantPrismaService`) tal cual, en vez de
   * reescribir esa query — mismo patrón que `crearPedido`, acá sin
   * vendedor real porque es solo lectura.
   */
  async producto(subdominio: string, productoId: string, request: AuthenticatedRequest) {
    const { tenant, config } = await this.resolverTiendaPublica(subdominio);
    const producto = await this.ecommerceRepository.buscarProductoPublico(tenant.id, productoId);
    if (!producto) throw new NotFoundException('Producto no encontrado');

    request.user = { tenantId: tenant.id, userId: 'tienda-online', email: '', roles: [], permisos: [] } as JwtPayloadUser;
    const variantesCrudas = await this.variantesService.listarPorProducto(productoId, config.bodegaId);
    const activas = variantesCrudas.filter((v) => v.activa);
    const precios = await this.ecommerceRepository.preciosPorVariantes(activas.map((v) => v.id));
    const precioPorVariante = new Map(precios.map((p) => [p.varianteId, p.precioVenta]));

    const variantes = activas.map((v) => ({
      id: v.id,
      etiqueta: v.valoresAtributo.map((va) => `${va.valorAtributo.atributo.nombre}: ${va.valorAtributo.valor}`).join(', '),
      precio: precioPorVariante.get(v.id) ?? null,
      stock: config.bodegaId && 'existencia' in v ? v.existencia : null,
    }));

    const relacionados = producto.categoria
      ? await this.ecommerceRepository.productosRelacionados({
          tenantId: tenant.id,
          categoriaId: producto.categoria.id,
          excluirProductoId: producto.id,
          bodegaId: config.bodegaId,
          limit: 4,
        })
      : [];

    const { imagenesAdicionales, ...datosProducto } = producto;
    return { ...datosProducto, imagenesAdicionales: imagenesAdicionales.map((i) => i.imagen), variantes, relacionados };
  }

  /**
   * Crea el pedido = crea una Factura CONTADO real (mismo motor que
   * Facturación/POS — ITBIS/stock/NCF sin duplicar nada) y la envuelve en
   * un `PedidoTienda` con los datos de contacto/entrega del guest. Sin
   * `formaPagoId`/`pagos`, la Factura queda EMITIDA sin pagar — lista
   * para el checkout público YA existente
   * (`cobros-publicos.service.ts.crearCheckout`, que exige exactamente
   * ese estado). `request` se "forja" con el tenant/vendedor resueltos
   * para reusar `ClientesService`/`FacturacionService` (request-scoped
   * vía `TenantPrismaService`) tal cual — mismo patrón documentado en
   * `CobrosPublicosService.procesarRetorno`.
   */
  async crearPedido(subdominio: string, dto: CrearPedidoTiendaDto, request: AuthenticatedRequest) {
    const { tenant, config } = await this.resolverTiendaPublica(subdominio);
    if (!config.bodegaId) {
      throw new ServiceUnavailableException('Esta tienda no tiene una bodega configurada — contactá al negocio');
    }

    const vendedor = await this.ecommerceRepository.buscarAdminMasAntiguo(tenant.id);
    if (!vendedor) {
      throw new ServiceUnavailableException('Esta tienda no puede procesar pedidos en este momento');
    }

    request.user = { tenantId: tenant.id, userId: vendedor.id, email: '', roles: [], permisos: [] } as JwtPayloadUser;

    const clienteId = await this.resolverClienteId(request, tenant.id);

    const factura = await this.facturacionService.crear(
      {
        clienteId,
        bodegaId: config.bodegaId,
        tipoFactura: 'CONTADO',
        lineas: dto.lineas.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId, cantidad: l.cantidad })),
      },
      tenant.id,
      vendedor.id,
    );

    await this.ecommerceRepository.crearPedido({
      tenantId: tenant.id,
      facturaId: factura.id,
      clienteNombre: dto.clienteNombre,
      clienteTelefono: dto.clienteTelefono,
      clienteEmail: dto.clienteEmail,
      direccionEntrega: dto.direccionEntrega,
      notas: dto.notas,
    });

    return { facturaId: factura.id };
  }

  async listarPedidos(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [pedidos, total] = await this.pedidosTiendaRepository.listar({ skip, take });
    const facturas = await this.pedidosTiendaRepository.facturasPorIds(pedidos.map((p) => p.facturaId));
    const facturasPorId = new Map(facturas.map((f) => [f.id, f]));
    const datos = pedidos.map((p) => ({ ...p, factura: facturasPorId.get(p.facturaId) ?? null }));
    return { datos, total, pagina, tamanoPagina };
  }

  /**
   * Fase 6 — si el `Authorization: Bearer` trae un token de cliente de
   * tienda válido Y para ESTE tenant, la Factura sale a nombre del
   * cliente real (aparece en su "Mis pedidos") en vez de "Consumidor
   * Final". El checkout sigue funcionando 100% sin sesión (token
   * ausente/inválido/vencido/de otro tenant) — esto es aditivo, nunca
   * bloquea la compra de un guest.
   */
  private async resolverClienteId(request: AuthenticatedRequest, tenantId: string): Promise<string> {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const payload = this.jwtService.verify<ClienteTiendaPayload>(header.slice('Bearer '.length), {
          secret: CLIENTE_TIENDA_JWT_SECRET,
        });
        if (payload.tenantId === tenantId) return payload.clienteId;
      } catch {
        // token inválido/vencido — sigue como guest.
      }
    }
    const consumidorFinal = await this.clientesService.buscarConsumidorFinal();
    if (!consumidorFinal) {
      throw new ServiceUnavailableException('Esta tienda no puede procesar pedidos en este momento');
    }
    return consumidorFinal.id;
  }

  /**
   * "Mis pedidos" del cliente autenticado — el `:subdominio` de la URL
   * debe corresponder al MISMO tenant del token (evita que un token
   * válido de otro tenant, aunque nadie lo emitiría así, sirva para leer
   * pedidos de una tienda ajena solo por cambiar la URL).
   */
  async misPedidos(subdominio: string, cliente: ClienteTiendaPayload) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    if (tenant.id !== cliente.tenantId) {
      throw new UnauthorizedException('Sesión inválida para esta tienda');
    }
    return this.ecommerceRepository.misPedidos(tenant.id, cliente.clienteId);
  }

  /** Fase 10 — "Ver detalle" de un pedido puntual (líneas de producto). Mismo chequeo de tenant que `misPedidos`; el 404 de "no pertenece" lo resuelve el repositorio (`findFirst` con `clienteId` incluido en el where, nunca solo por id). */
  async detallePedido(subdominio: string, cliente: ClienteTiendaPayload, facturaId: string) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    if (tenant.id !== cliente.tenantId) throw new UnauthorizedException('Sesión inválida para esta tienda');
    const detalle = await this.ecommerceRepository.detallePedido(tenant.id, cliente.clienteId, facturaId);
    if (!detalle) throw new NotFoundException('Pedido no encontrado');
    return detalle;
  }

  async miPerfil(subdominio: string, cliente: ClienteTiendaPayload) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    if (tenant.id !== cliente.tenantId) throw new UnauthorizedException('Sesión inválida para esta tienda');
    return this.ecommerceRepository.miPerfil(cliente.clienteId);
  }

  /** Mismo criterio de unicidad "email con contraseña" que `ClienteTiendaAuthService.registro` — si el nuevo email ya lo usa OTRA cuenta con password de este tenant, no se permite. */
  async actualizarPerfil(subdominio: string, cliente: ClienteTiendaPayload, dto: ActualizarPerfilClienteTiendaDto) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    if (tenant.id !== cliente.tenantId) throw new UnauthorizedException('Sesión inválida para esta tienda');
    if (dto.email) {
      const existente = await this.ecommerceRepository.buscarClientePorEmail(tenant.id, dto.email);
      if (existente && existente.id !== cliente.clienteId) {
        throw new ConflictException('Ya existe una cuenta con ese correo en esta tienda');
      }
    }
    return this.ecommerceRepository.actualizarPerfil(cliente.clienteId, dto);
  }

  async misDirecciones(subdominio: string, cliente: ClienteTiendaPayload) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    if (tenant.id !== cliente.tenantId) throw new UnauthorizedException('Sesión inválida para esta tienda');
    return this.ecommerceRepository.misDirecciones(cliente.clienteId);
  }

  async crearDireccion(subdominio: string, cliente: ClienteTiendaPayload, dto: CrearDireccionClienteDto) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    if (tenant.id !== cliente.tenantId) throw new UnauthorizedException('Sesión inválida para esta tienda');
    return this.ecommerceRepository.crearDireccion(cliente.clienteId, dto);
  }

  /** IDOR-safe: resuelve la dirección por id y valida que sea del cliente autenticado ANTES de tocarla — nunca confiar en el id de la URL. */
  private async direccionDelCliente(direccionId: string, clienteId: string) {
    const direccion = await this.ecommerceRepository.buscarDireccion(direccionId);
    if (!direccion || direccion.clienteId !== clienteId) throw new NotFoundException('Dirección no encontrada');
    return direccion;
  }

  async actualizarDireccion(subdominio: string, cliente: ClienteTiendaPayload, direccionId: string, dto: ActualizarDireccionClienteDto) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    if (tenant.id !== cliente.tenantId) throw new UnauthorizedException('Sesión inválida para esta tienda');
    await this.direccionDelCliente(direccionId, cliente.clienteId);
    return this.ecommerceRepository.actualizarDireccion(direccionId, cliente.clienteId, dto);
  }

  async eliminarDireccion(subdominio: string, cliente: ClienteTiendaPayload, direccionId: string) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    if (tenant.id !== cliente.tenantId) throw new UnauthorizedException('Sesión inválida para esta tienda');
    await this.direccionDelCliente(direccionId, cliente.clienteId);
    return this.ecommerceRepository.eliminarDireccion(direccionId);
  }
}
