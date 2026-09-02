import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EcommerceRepository } from './ecommerce.repository';
import { PedidosTiendaRepository } from './pedidos-tienda.repository';
import { resolverConfigTienda } from './resolver-config-tienda';
import { moduloEstaActivo } from '../planes/resolver-modulos-activos';
import { paginar } from '../common/types/pagina-resultado';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogoTiendaQueryDto } from './dto/catalogo-tienda-query.dto';
import { CrearPedidoTiendaDto } from './dto/crear-pedido-tienda.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { ClientesService } from '../clientes/clientes.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { VariantesService } from '../variantes/variantes.service';
import { AuthenticatedRequest, JwtPayloadUser } from '../common/types/authenticated-request';

@Injectable()
export class EcommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecommerceRepository: EcommerceRepository,
    private readonly pedidosTiendaRepository: PedidosTiendaRepository,
    private readonly clientesService: ClientesService,
    private readonly facturacionService: FacturacionService,
    private readonly variantesService: VariantesService,
  ) {}

  /**
   * Resuelve tenant + config a partir del `:subdominio` de la URL — sin
   * JWT, así que ninguna de estas condiciones puede delegarse en
   * ModuloActivoGuard (que se auto-desactiva sin `request.user`, ver
   * modulo-activo.guard.ts). Un 404 parejo para tenant inexistente,
   * suspendido, sin el módulo "ecommerce" activo, o con la tienda
   * desactivada — no se distingue el motivo al público, igual que
   * cualquier otro recurso que no existe.
   */
  async resolverTiendaPublica(subdominio: string) {
    const tenant = await this.ecommerceRepository.buscarTenantPorSubdominio(subdominio);
    if (!tenant || tenant.estado !== 'ACTIVO') {
      throw new NotFoundException('Tienda no encontrada');
    }

    const moduloActivo = await moduloEstaActivo(this.prisma, tenant.id, 'ecommerce');
    if (!moduloActivo) {
      throw new NotFoundException('Tienda no encontrada');
    }

    const config = await resolverConfigTienda(this.prisma, tenant.id);
    if (!config.activa) {
      throw new NotFoundException('Tienda no encontrada');
    }

    return { tenant, config };
  }

  async obtenerConfig(subdominio: string) {
    const { tenant, config } = await this.resolverTiendaPublica(subdominio);
    return {
      nombre: config.nombre || tenant.nombre,
      plantilla: config.plantilla,
      logo: config.logo ?? null,
      banner: config.banner ?? null,
      colorAcento: config.colorAcento ?? null,
    };
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

    const { imagenesAdicionales, ...datosProducto } = producto;
    return { ...datosProducto, imagenesAdicionales: imagenesAdicionales.map((i) => i.imagen), variantes };
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

    const consumidorFinal = await this.clientesService.buscarConsumidorFinal();
    if (!consumidorFinal) {
      throw new ServiceUnavailableException('Esta tienda no puede procesar pedidos en este momento');
    }

    const factura = await this.facturacionService.crear(
      {
        clienteId: consumidorFinal.id,
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
}
