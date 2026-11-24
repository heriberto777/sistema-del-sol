import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoriaReporteTenant, EstadoReporteTenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginar } from '../common/types/pagina-resultado';
import { CrearMensajeReporteTenantDto } from './dto/crear-mensaje-reporte-tenant.dto';

const SELECT_MENSAJE = {
  id: true,
  autorTipo: true,
  autorUsuarioId: true,
  autorUsuario: { select: { id: true, nombre: true } },
  autorAdminId: true,
  autorAdmin: { select: { id: true, nombre: true } },
  cuerpo: true,
  adjuntoBase64: true,
  adjuntoNombre: true,
  createdAt: true,
} as const;

const INCLUDE_REPORTE = {
  tenant: {
    select: {
      id: true,
      nombre: true,
      subdominio: true,
      rnc: true,
      telefono: true,
      email: true,
      plan: { select: { nombre: true } },
    },
  },
  usuario: { select: { id: true, nombre: true, email: true } },
  mensajes: { orderBy: { createdAt: 'desc' as const }, take: 1, select: SELECT_MENSAJE },
} as const;

/** Cruza todos los tenants — a propósito, `PrismaService` global (el lado tenant usa `TenantPrismaService`, ver `reportes-tenant.repository.ts`). */
@Injectable()
export class PlatformReportesTenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: {
    pagina?: number;
    tamanoPagina?: number;
    busqueda?: string;
    tenantId?: string;
    estado?: EstadoReporteTenant;
    categoria?: CategoriaReporteTenant;
    desde?: string;
    hasta?: string;
  }) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const where = {
      tenantId: query.tenantId,
      estado: query.estado,
      categoria: query.categoria,
      ...(query.desde || query.hasta
        ? {
            createdAt: {
              ...(query.desde ? { gte: new Date(query.desde) } : {}),
              ...(query.hasta ? { lte: new Date(`${query.hasta}T23:59:59.999`) } : {}),
            },
          }
        : {}),
      ...(query.busqueda
        ? {
            OR: [
              { asunto: { contains: query.busqueda, mode: 'insensitive' as const } },
              { tenant: { nombre: { contains: query.busqueda, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [datos, total] = await Promise.all([
      this.prisma.reporteTenant.findMany({ where, include: INCLUDE_REPORTE, orderBy: { ultimoMensajeEn: 'desc' }, skip, take }),
      this.prisma.reporteTenant.count({ where }),
    ]);

    return { datos, total, pagina, tamanoPagina };
  }

  async buscarPorIdOrThrow(id: string) {
    const reporte = await this.prisma.reporteTenant.findUnique({ where: { id }, include: INCLUDE_REPORTE });
    if (!reporte) throw new NotFoundException('Ticket no encontrado');
    return reporte;
  }

  async listarMensajes(id: string) {
    await this.buscarPorIdOrThrow(id);
    return this.prisma.reporteTenantMensaje.findMany({ where: { reporteId: id }, orderBy: { createdAt: 'asc' }, select: SELECT_MENSAJE });
  }

  /**
   * `nuevoEstado` lo decide el service (lógica de negocio, ver
   * `PlatformReportesTenantService.agregarMensaje`) — el repositorio solo
   * ejecuta la transacción (mensaje + `ultimoMensajeEn` + estado si
   * corresponde).
   */
  async agregarMensaje(id: string, dto: CrearMensajeReporteTenantDto, adminId: string, nuevoEstado?: 'EN_REVISION') {
    return this.prisma.$transaction(async (tx) => {
      const existe = await tx.reporteTenant.findUnique({ where: { id }, select: { id: true } });
      if (!existe) throw new NotFoundException('Ticket no encontrado');

      const mensaje = await tx.reporteTenantMensaje.create({
        data: {
          reporteId: id,
          autorTipo: 'SOPORTE',
          autorAdminId: adminId,
          cuerpo: dto.cuerpo as object,
          adjuntoBase64: dto.adjuntoBase64,
          adjuntoNombre: dto.adjuntoNombre,
        },
        select: SELECT_MENSAJE,
      });

      await tx.reporteTenant.update({
        where: { id },
        data: { ultimoMensajeEn: mensaje.createdAt, estado: nuevoEstado },
      });

      return mensaje;
    });
  }

  cambiarEstado(id: string, estado: EstadoReporteTenant) {
    return this.prisma.reporteTenant.update({ where: { id }, data: { estado }, include: INCLUDE_REPORTE });
  }

  /** Para el badge del sidebar de plataforma — solo cuenta, nunca trae filas. */
  contarNuevos() {
    return this.prisma.reporteTenant.count({ where: { estado: 'NUEVO' } });
  }
}
