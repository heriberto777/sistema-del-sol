import { Injectable } from '@nestjs/common';
import { Prisma, EstadoOportunidad } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearOportunidadDto } from './dto/crear-oportunidad.dto';

const INCLUDE_OPORTUNIDAD = {
  cliente: { select: { id: true, nombre: true } },
  lead: { select: { id: true, nombre: true } },
  etapa: { select: { id: true, nombre: true, color: true, orden: true } },
  vendedor: { select: { id: true, nombre: true } },
} satisfies Prisma.OportunidadInclude;

interface FiltrosOportunidades {
  skip: number;
  take: number;
  busqueda?: string;
  estado?: EstadoOportunidad;
  vendedorId?: string;
  clienteId?: string;
}

@Injectable()
export class OportunidadesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: Omit<CrearOportunidadDto, 'fechaCierreEstimada'> & { tenantId: string; vendedorId: string; fechaCierreEstimada: Date }) {
    return this.db.oportunidad.create({ data: dto, include: INCLUDE_OPORTUNIDAD });
  }

  async listar({ skip, take, busqueda, estado, vendedorId, clienteId }: FiltrosOportunidades) {
    const where: Prisma.OportunidadWhereInput = {
      ...(estado ? { estado } : {}),
      ...(vendedorId ? { vendedorId } : {}),
      ...(clienteId ? { clienteId } : {}),
      ...(busqueda ? { titulo: { contains: busqueda, mode: 'insensitive' as const } } : {}),
    };

    const [datos, total] = await Promise.all([
      this.db.oportunidad.findMany({ where, orderBy: { createdAt: 'desc' }, include: INCLUDE_OPORTUNIDAD, skip, take }),
      this.db.oportunidad.count({ where }),
    ]);

    return { datos, total };
  }

  /**
   * Para el Kanban — Fase 1 trae el pipeline entero de una sola vez (no
   * se puede paginar una columna de Kanban a medias) con un tope de
   * seguridad (`take`), no el listado paginado normal de arriba.
   * Limitación conocida: un pipeline con más de `take` oportunidades
   * abiertas simultáneas no entra completo en el tablero — aceptable
   * para Fase 1, documentado en el artifact de diseño.
   */
  listarPipeline(take = 500) {
    return this.db.oportunidad.findMany({
      where: { estado: 'ABIERTA' },
      orderBy: { createdAt: 'desc' },
      include: INCLUDE_OPORTUNIDAD,
      take,
    });
  }

  listarCerradasRecientes(estado: 'GANADA' | 'PERDIDA', desde: Date, take = 50) {
    return this.db.oportunidad.findMany({
      where: { estado, fechaCierreReal: { gte: desde } },
      orderBy: { fechaCierreReal: 'desc' },
      include: INCLUDE_OPORTUNIDAD,
      take,
    });
  }

  buscarPorId(id: string) {
    return this.db.oportunidad.findUniqueOrThrow({ where: { id }, include: INCLUDE_OPORTUNIDAD });
  }

  actualizar(id: string, dto: Partial<Omit<CrearOportunidadDto, 'fechaCierreEstimada'>> & { fechaCierreEstimada?: Date }) {
    return this.db.oportunidad.update({ where: { id }, data: dto, include: INCLUDE_OPORTUNIDAD });
  }

  cambiarEtapa(id: string, etapaId: string) {
    return this.db.oportunidad.update({ where: { id }, data: { etapaId }, include: INCLUDE_OPORTUNIDAD });
  }

  cerrar(id: string, estado: 'GANADA' | 'PERDIDA', motivoPerdida?: string) {
    return this.db.oportunidad.update({
      where: { id },
      data: { estado, motivoPerdida: estado === 'PERDIDA' ? motivoPerdida : null, fechaCierreReal: new Date() },
      include: INCLUDE_OPORTUNIDAD,
    });
  }

  /**
   * Fase 2 — "Ganar y generar cotización". `clienteId` se pasa SOLO
   * cuando la oportunidad estaba sobre un Lead recién convertido (ver
   * OportunidadesService.convertirEnCotizacion) — ahí sí queda con
   * clienteId Y leadId a la vez (el Lead se conserva como historial de
   * origen), excepción deliberada a la regla de "exactamente uno" que
   * rige en crear()/actualizar(): una vez GANADA, `actualizar()` ya la
   * bloquea (validarQueSigaAbierta), así que ese invariante relajado
   * nunca se vuelve a chequear sobre este registro.
   */
  cerrarConCotizacion(id: string, cotizacionId: string, clienteId?: string) {
    return this.db.oportunidad.update({
      where: { id },
      data: { estado: 'GANADA', cotizacionId, fechaCierreReal: new Date(), ...(clienteId ? { clienteId } : {}) },
      include: INCLUDE_OPORTUNIDAD,
    });
  }

  /** Valida que un vendedorId pertenezca a ESTE tenant antes de asignarlo (mismo criterio que LeadsRepository.validarVendedorDelTenant). */
  validarVendedorDelTenant(id: string) {
    return this.db.user.findUniqueOrThrow({ where: { id }, select: { id: true } });
  }

  eliminar(id: string) {
    return this.db.oportunidad.delete({ where: { id } });
  }
}
