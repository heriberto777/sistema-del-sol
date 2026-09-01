import { Injectable, NotFoundException } from '@nestjs/common';
import { EcommerceRepository } from './ecommerce.repository';
import { resolverConfigTienda } from './resolver-config-tienda';
import { moduloEstaActivo } from '../planes/resolver-modulos-activos';
import { paginar } from '../common/types/pagina-resultado';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogoTiendaQueryDto } from './dto/catalogo-tienda-query.dto';

@Injectable()
export class EcommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecommerceRepository: EcommerceRepository,
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

  async producto(subdominio: string, productoId: string) {
    const { tenant, config } = await this.resolverTiendaPublica(subdominio);
    const producto = await this.ecommerceRepository.buscarProductoPublico(tenant.id, productoId, config.bodegaId);
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }
}
