import { Injectable } from '@nestjs/common';
import { EstadoPublicacionSocial, FormatoPublicacionSocial, OrigenImagenPublicacionSocial } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';

const INCLUDE_PUBLICACION = {
  producto: {
    select: {
      id: true,
      nombre: true,
      codigo: true,
      categoriaId: true,
      variantes: {
        take: 1,
        orderBy: { createdAt: 'asc' as const },
        select: { precios: { where: { listaPrecio: 'GENERAL', vigenteHasta: null }, select: { precioVenta: true }, take: 1 } },
      },
    },
  },
  plantilla: { select: { id: true, clave: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
  aprobadoPor: { select: { id: true, nombre: true } },
} as const;

// Fase 5 — historial completo, solo para el detalle (`buscarPorId`): cada
// versión trae su imagen base64 completa, demasiado pesado para el listado
// paginado — ahí se sigue usando INCLUDE_PUBLICACION tal cual.
const INCLUDE_PUBLICACION_DETALLE = {
  ...INCLUDE_PUBLICACION,
  versiones: {
    orderBy: { numero: 'asc' as const },
    include: { creadoPor: { select: { id: true, nombre: true } } },
  },
} as const;

/** Un solo repositorio para todo el plugin (mismo criterio que ProyectosRepository). `PlantillaPublicacionSocial` es catálogo global (no tenant-scoped) pero se consulta igual vía `TenantPrismaService.client` — solo pasa "sin filtro" de tenantId, sigue protegido por RLS/SET LOCAL como cualquier otra query de este cliente. */
@Injectable()
export class PublicacionesSocialesRepository {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** Fase 5 — inserta también la versión 1 en la misma escritura (nested create de Prisma) — es la primera fila del historial. */
  crear(data: {
    tenantId: string;
    productoId: string;
    plantillaId: string;
    imagen: string;
    creadoPorId: string;
    origen: OrigenImagenPublicacionSocial;
    promptIa: string | null;
    formato: FormatoPublicacionSocial;
  }) {
    return this.db.publicacionSocial.create({
      data: {
        ...data,
        versiones: {
          create: {
            numero: 1,
            imagen: data.imagen,
            plantillaId: data.plantillaId,
            origen: data.origen,
            promptIa: data.promptIa,
            formato: data.formato,
            creadoPorId: data.creadoPorId,
          },
        },
      },
      include: INCLUDE_PUBLICACION,
    });
  }

  buscarPorId(id: string) {
    return this.db.publicacionSocial.findUniqueOrThrow({ where: { id }, include: INCLUDE_PUBLICACION_DETALLE });
  }

  /** Fase 5 — el comentario de "pedime esto" queda para siempre en la versión que el aprobador estaba revisando. */
  actualizarComentarioVersion(versionId: string, comentario: string) {
    return this.db.publicacionSocialVersion.update({ where: { id: versionId }, data: { comentarioCambios: comentario } });
  }

  /**
   * Fase 5 — el creador regeneró tras un pedido de cambios: actualiza los
   * campos "vigentes" de la publicación Y agrega la versión N+1 en la
   * misma escritura, y el estado vuelve a BORRADOR (listo para reenviar
   * a aprobación).
   */
  regenerar(
    id: string,
    data: {
      numero: number;
      imagen: string;
      plantillaId: string;
      origen: OrigenImagenPublicacionSocial;
      promptIa: string | null;
      formato: FormatoPublicacionSocial;
      creadoPorId: string;
    },
  ) {
    return this.db.publicacionSocial.update({
      where: { id },
      data: {
        estado: 'BORRADOR',
        imagen: data.imagen,
        plantillaId: data.plantillaId,
        origen: data.origen,
        promptIa: data.promptIa,
        formato: data.formato,
        versiones: {
          create: {
            numero: data.numero,
            imagen: data.imagen,
            plantillaId: data.plantillaId,
            origen: data.origen,
            promptIa: data.promptIa,
            formato: data.formato,
            creadoPorId: data.creadoPorId,
          },
        },
      },
      include: INCLUDE_PUBLICACION_DETALLE,
    });
  }

  listar(params: { skip: number; take: number; estado?: EstadoPublicacionSocial }) {
    const where = params.estado ? { estado: params.estado } : {};
    return Promise.all([
      this.db.publicacionSocial.findMany({ where, orderBy: { createdAt: 'desc' as const }, skip: params.skip, take: params.take, include: INCLUDE_PUBLICACION }),
      this.db.publicacionSocial.count({ where }),
    ]);
  }

  actualizarEstado(
    id: string,
    data: { estado: EstadoPublicacionSocial; aprobadoPorId?: string; motivoRechazo?: string; fechaResolucion?: Date },
  ) {
    return this.db.publicacionSocial.update({ where: { id }, data, include: INCLUDE_PUBLICACION });
  }

  /** Producto + precio vigente, para armar el banner — misma consulta de precio que `ProductosRepository.catalogo`. */
  buscarProductoParaGenerar(productoId: string) {
    return this.db.producto.findUniqueOrThrow({
      where: { id: productoId },
      select: {
        id: true,
        nombre: true,
        imagen: true,
        categoriaId: true,
        variantes: {
          take: 1,
          orderBy: { createdAt: 'asc' as const },
          select: { precios: { where: { listaPrecio: 'GENERAL', vigenteHasta: null }, select: { precioVenta: true }, take: 1 } },
        },
      },
    });
  }

  buscarPlantillaPorId(id: string) {
    return this.db.plantillaPublicacionSocial.findUniqueOrThrow({ where: { id } });
  }

  listarPlantillasActivas() {
    return this.db.plantillaPublicacionSocial.findMany({ where: { activa: true }, orderBy: { nombre: 'asc' } });
  }

  /** Fase 2 — cuántas publicaciones con fondo de IA ya generó este tenant en lo que va del mes calendario (para el tope mensual). */
  contarGeneracionesIaDelMes(tenantId: string) {
    const ahora = new Date();
    const inicioDeMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    return this.db.publicacionSocial.count({
      where: { tenantId, origen: 'IA', createdAt: { gte: inicioDeMes } },
    });
  }

  /** `PlataformaConfiguracion` es fila única, NO tenant-scoped — `PrismaService` global, mismo criterio que `resolverPersonalizacionDocumento`. */
  async buscarLimiteIaFondo(): Promise<number> {
    const config = await this.prisma.plataformaConfiguracion.findFirst({ select: { iaFondoLimiteMensual: true } });
    return config?.iaFondoLimiteMensual ?? 20;
  }
}
