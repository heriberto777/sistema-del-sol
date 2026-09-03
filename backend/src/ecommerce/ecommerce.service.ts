import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EcommerceRepository } from './ecommerce.repository';
import { PedidosTiendaRepository } from './pedidos-tienda.repository';
import { SeccionesTiendaRepository } from './secciones-tienda.repository';
import { resolverTiendaPublica } from './resolver-tienda-publica';
import { paginar } from '../common/types/pagina-resultado';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogoTiendaQueryDto } from './dto/catalogo-tienda-query.dto';
import { CrearPedidoTiendaDto } from './dto/crear-pedido-tienda.dto';
import { ActualizarPerfilClienteTiendaDto } from './dto/actualizar-perfil-cliente-tienda.dto';
import { ActualizarDireccionClienteDto, CrearDireccionClienteDto } from './dto/direccion-cliente.dto';
import { GuardarCarritoTiendaDto } from './dto/guardar-carrito-tienda.dto';
import { CrearSeccionTiendaDto } from './dto/crear-seccion-tienda.dto';
import { ReordenarSeccionesTiendaDto } from './dto/reordenar-secciones-tienda.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { ClientesService } from '../clientes/clientes.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { VariantesService } from '../variantes/variantes.service';
import { OfertasService, OfertaVisibleProducto } from '../ofertas/ofertas.service';
import { AuthenticatedRequest, JwtPayloadUser } from '../common/types/authenticated-request';
import { CLIENTE_TIENDA_JWT_SECRET } from '../cliente-tienda-auth/cliente-tienda-jwt.constants';
import { ClienteTiendaPayload } from '../cliente-tienda-auth/cliente-tienda-authenticated-request';

@Injectable()
export class EcommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecommerceRepository: EcommerceRepository,
    private readonly pedidosTiendaRepository: PedidosTiendaRepository,
    private readonly seccionesTiendaRepository: SeccionesTiendaRepository,
    private readonly clientesService: ClientesService,
    private readonly facturacionService: FacturacionService,
    private readonly variantesService: VariantesService,
    private readonly ofertasService: OfertasService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Fase 13 — cruza cada producto contra el motor de Ofertas real
   * (`OfertasService.resolverOfertaVisibleProducto`, misma matemática que
   * la venta) para adjuntar el precio con descuento u mecánica BOGO a
   * mostrar en la tarjeta. `OfertasRepository` es request-scoped
   * (`TenantPrismaService`), por eso exige `request.user.tenantId` ya
   * forjado por el caller (mismo patrón que `producto()`). Una consulta
   * por producto — aceptable al tamaño de una página paginada, nunca un
   * listado sin límite.
   */
  private async adjuntarOfertas<T extends { id: string; precio: unknown; categoria: { id: string } | null }>(
    items: T[],
  ): Promise<(T & { oferta: OfertaVisibleProducto | null })[]> {
    const ofertas = await Promise.all(
      items.map((item) =>
        item.precio
          ? this.ofertasService.resolverOfertaVisibleProducto(item.id, item.categoria?.id ?? null, Number(item.precio as string | number))
          : Promise.resolve(null),
      ),
    );
    return items.map((item, i) => ({ ...item, oferta: ofertas[i] }));
  }

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

  /** Fase 12 — categorías con productos visibles, para los chips de filtro de las plantillas "marketplace" (Bazar/Vitrina/Sol Market). */
  async categorias(subdominio: string) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    return this.ecommerceRepository.categoriasPublicas(tenant.id);
  }

  async catalogo(subdominio: string, query: CatalogoTiendaQueryDto, request: AuthenticatedRequest) {
    const { tenant, config } = await this.resolverTiendaPublica(subdominio);
    request.user = { tenantId: tenant.id, userId: 'tienda-online', email: '', roles: [], permisos: [] } as JwtPayloadUser;
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [productos, total] = await this.ecommerceRepository.catalogo({
      tenantId: tenant.id,
      bodegaId: config.bodegaId,
      skip,
      take,
      busqueda: query.busqueda,
      categoriaId: query.categoriaId,
      destacado: query.destacado === 'true' ? true : undefined,
    });
    const datos = await this.adjuntarOfertas(productos);
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
    const categoriaId = producto.categoria?.id ?? null;

    const variantes = await Promise.all(
      activas.map(async (v) => {
        const precio = precioPorVariante.get(v.id) ?? null;
        return {
          id: v.id,
          etiqueta: v.valoresAtributo.map((va) => `${va.valorAtributo.atributo.nombre}: ${va.valorAtributo.valor}`).join(', '),
          precio,
          stock: config.bodegaId && 'existencia' in v ? v.existencia : null,
          oferta: precio ? await this.ofertasService.resolverOfertaVisibleProducto(productoId, categoriaId, Number(precio)) : null,
        };
      }),
    );

    const relacionadosCrudos = await this.ecommerceRepository.productosRelacionados({
      tenantId: tenant.id,
      categoriaId,
      excluirProductoId: producto.id,
      bodegaId: config.bodegaId,
      limit: 4,
    });
    const relacionados = await this.adjuntarOfertas(relacionadosCrudos);

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

  /** Fase 14 — "Ver detalle" de un pedido puntual en el panel admin (líneas de factura + datos de contacto del pedido). */
  async detallePedidoAdmin(facturaId: string) {
    const detalle = await this.pedidosTiendaRepository.detalle(facturaId);
    if (!detalle) throw new NotFoundException('Pedido no encontrado');
    return detalle;
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

  /**
   * Fase 16 — carrito persistente del cliente logueado, para recuperarlo
   * en otro dispositivo. `[]` si nunca guardó ninguno (mismo criterio que
   * "sin oferta" en otros lados: ausencia de dato, no un error). El JSON
   * se parsea defensivo (mismo patrón que `TIENDA_TEMA`) — un blob
   * corrupto no debe romper el storefront, solo perder ese carrito.
   */
  async obtenerCarrito(subdominio: string, cliente: ClienteTiendaPayload) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    if (tenant.id !== cliente.tenantId) throw new UnauthorizedException('Sesión inválida para esta tienda');
    const fila = await this.ecommerceRepository.obtenerCarrito(cliente.clienteId);
    if (!fila) return { items: [] };
    try {
      return { items: JSON.parse(fila.itemsJson) };
    } catch {
      return { items: [] };
    }
  }

  async guardarCarrito(subdominio: string, cliente: ClienteTiendaPayload, dto: GuardarCarritoTiendaDto) {
    const { tenant } = await this.resolverTiendaPublica(subdominio);
    if (tenant.id !== cliente.tenantId) throw new UnauthorizedException('Sesión inválida para esta tienda');
    await this.ecommerceRepository.guardarCarrito(cliente.clienteId, JSON.stringify(dto.items));
    return { ok: true };
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

  /**
   * Fase 17, "Secciones Dinámicas" — bloques del Home en el orden que
   * definió el admin, con sus productos/categorías ya resueltos.
   * `adjuntarOfertas` depende de `OfertasRepository`, request-scoped vía
   * `TenantPrismaService` — mismo "forjado" de `request.user` que
   * `catalogo()`/`producto()`, sin esto revienta con "No hay tenant en el
   * contexto de la petición" (bug real, encontrado en la verificación en
   * vivo de esta fase).
   */
  async secciones(subdominio: string, request: AuthenticatedRequest) {
    const { tenant, config } = await this.resolverTiendaPublica(subdominio);
    request.user = { tenantId: tenant.id, userId: 'tienda-online', email: '', roles: [], permisos: [] } as JwtPayloadUser;
    const secciones = await this.ecommerceRepository.seccionesActivasPublicas(tenant.id, config.bodegaId);
    return Promise.all(secciones.map(async (s) => ({ ...s, productos: await this.adjuntarOfertas(s.productos) })));
  }

  /** Panel admin "Secciones del Home" (Fase 17) — lista TODO (incl. inactivas), a diferencia de `secciones()` público. */
  listarSecciones() {
    return this.seccionesTiendaRepository.listar();
  }

  async crearSeccion(dto: CrearSeccionTiendaDto, tenantId: string) {
    this.validarTipoSeccion(dto);
    return this.seccionesTiendaRepository.crear(tenantId, dto);
  }

  /**
   * Mismo criterio que `OfertasService.actualizar` — combina el DTO
   * parcial con la sección ya guardada antes de revalidar, para atrapar
   * un PATCH que cambia `tipo` sin mandar el campo que ese tipo nuevo
   * necesita (ej. pasar de PRODUCTOS a CATEGORIA sin mandar
   * `categoriaId`), algo que `ValidateIf` del DTO no puede ver por sí
   * solo contra un body parcial.
   */
  async actualizarSeccion(id: string, dto: Partial<CrearSeccionTiendaDto>) {
    const actual = await this.seccionesTiendaRepository.buscarPorId(id);
    const combinado: CrearSeccionTiendaDto = {
      tipo: dto.tipo ?? actual.tipo,
      titulo: dto.titulo ?? actual.titulo,
      categoriaId: dto.categoriaId !== undefined ? dto.categoriaId : (actual.categoriaId ?? undefined),
      productoIds: dto.productoIds ?? actual.productos.map((p) => p.productoId),
      categoriaIds: dto.categoriaIds ?? actual.categorias.map((c) => c.categoriaId),
    };
    this.validarTipoSeccion(combinado);
    return this.seccionesTiendaRepository.actualizar(id, dto);
  }

  eliminarSeccion(id: string) {
    return this.seccionesTiendaRepository.eliminar(id);
  }

  reordenarSecciones(dto: ReordenarSeccionesTiendaDto) {
    return this.seccionesTiendaRepository.reordenar(dto.ids);
  }

  /**
   * Qué campos aplican depende de `tipo` — el schema no lo puede exigir
   * (todos nullable), se valida acá, mismo criterio que
   * `OfertasService.validarAlcance`. `BANNER` comparte la validación de
   * `PRODUCTOS` (misma tabla `productos`, solo cambia el renderizado).
   */
  private validarTipoSeccion(dto: Pick<CrearSeccionTiendaDto, 'tipo' | 'categoriaId' | 'productoIds' | 'categoriaIds'>) {
    if (dto.tipo === 'PRODUCTOS' || dto.tipo === 'BANNER') {
      if (!dto.productoIds || dto.productoIds.length === 0) {
        throw new BadRequestException(`Una sección de tipo ${dto.tipo} necesita al menos un producto elegido a mano`);
      }
    } else if (dto.tipo === 'CATEGORIA') {
      if (!dto.categoriaId) throw new BadRequestException('Una sección de tipo CATEGORIA necesita categoriaId');
    } else if (dto.tipo === 'MINIGRID') {
      if (!dto.categoriaIds || dto.categoriaIds.length < 2 || dto.categoriaIds.length > 4) {
        throw new BadRequestException('Una sección de tipo MINIGRID necesita entre 2 y 4 categorías');
      }
    }
  }
}
