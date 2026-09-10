import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolverTenantPublicoInmobiliaria } from './resolver-tenant-publico-inmobiliaria';
import { ListadoPropiedadesPublicoQueryDto } from './dto/listado-propiedades-publico-query.dto';
import { CrearAlertaBusquedaDto } from './dto/crear-alerta-busqueda.dto';
import { paginar } from '../common/types/pagina-resultado';

const INCLUDE_PROPIEDAD_PUBLICA = {
  imagenes: { orderBy: { orden: 'asc' as const } },
  agente: { select: { nombre: true, telefono: true } },
};

/**
 * Catálogo PÚBLICO de propiedades (sin JWT) — mismo criterio que
 * EcommerceService: usa `PrismaService` global (no `TenantPrismaService`,
 * que exige un request autenticado) con el `tenantId` ya resuelto por
 * `resolverTenantPublicoInmobiliaria`. Solo expone propiedades
 * `estado: 'ACTIVA'` — pausadas/reservadas/vendidas/alquiladas quedan
 * fuera del catálogo público (siguen visibles en el panel admin).
 */
@Injectable()
export class InmobiliariaPublicaService {
  constructor(private readonly prisma: PrismaService) {}

  async config(subdominio: string) {
    const tenant = await resolverTenantPublicoInmobiliaria(this.prisma, subdominio);
    return { nombre: tenant.nombre, logo: tenant.logo };
  }

  async listar(subdominio: string, query: ListadoPropiedadesPublicoQueryDto) {
    const tenant = await resolverTenantPublicoInmobiliaria(this.prisma, subdominio);
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);

    const where = {
      tenantId: tenant.id,
      estado: 'ACTIVA' as const,
      ...(query.operacion ? { operacion: query.operacion } : {}),
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.busqueda
        ? {
            OR: [
              { titulo: { contains: query.busqueda, mode: 'insensitive' as const } },
              { ubicacion: { contains: query.busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.precioMin !== undefined || query.precioMax !== undefined
        ? { precio: { ...(query.precioMin !== undefined ? { gte: query.precioMin } : {}), ...(query.precioMax !== undefined ? { lte: query.precioMax } : {}) } }
        : {}),
      ...(query.habitacionesMin !== undefined ? { habitaciones: { gte: query.habitacionesMin } } : {}),
      // Favoritos/comparador (Fase 4) — el visitante manda los ids que
      // guardó en su navegador (localStorage, sin cuenta), acá solo se
      // verifica que sigan siendo del tenant y ACTIVA (ver comentario en
      // buscarPorId sobre por qué se filtra siempre por estado).
      ...(query.ids?.length ? { id: { in: query.ids } } : {}),
    };

    const [datos, total] = await Promise.all([
      this.prisma.propiedad.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: INCLUDE_PROPIEDAD_PUBLICA }),
      this.prisma.propiedad.count({ where }),
    ]);
    return { datos, total, pagina, tamanoPagina };
  }

  async buscarPorId(subdominio: string, id: string) {
    const tenant = await resolverTenantPublicoInmobiliaria(this.prisma, subdominio);
    const propiedad = await this.prisma.propiedad.findFirst({
      where: { id, tenantId: tenant.id, estado: 'ACTIVA' },
      include: INCLUDE_PROPIEDAD_PUBLICA,
    });
    // findFirst (no findFirstOrThrow) — acá SÍ hace falta el 404 explícito
    // en vez de dejar propagar el error de Prisma, porque el filtro
    // `estado: 'ACTIVA'` es intencional (una propiedad pausada/vendida
    // existe mas no debe ser visible al público) y merece el mismo
    // mensaje genérico que "no existe", no un error interno.
    if (!propiedad) throw new NotFoundException('Propiedad no encontrada');
    return propiedad;
  }

  /** Fase 4 — sin cuenta, un email + criterios. El cron (`AlertasBusquedaPropiedadCronService`) hace el resto. */
  async crearAlerta(subdominio: string, dto: CrearAlertaBusquedaDto) {
    const tenant = await resolverTenantPublicoInmobiliaria(this.prisma, subdominio);
    const alerta = await this.prisma.alertaBusquedaPropiedad.create({ data: { ...dto, tenantId: tenant.id } });
    return { id: alerta.id };
  }
}
