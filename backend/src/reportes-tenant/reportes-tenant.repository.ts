import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearReporteTenantDto } from './dto/crear-reporte-tenant.dto';
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

@Injectable()
export class ReportesTenantRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  // `tenantId` explícito en `data` — TypeScript no sabe que TenantPrismaService
  // lo inyecta en runtime (eso pasa dentro de $allOperations, invisible al
  // tipado estático de Prisma), mismo patrón que GestionCobroRepository.crearGestion.
  // Nested create: el ticket y su primer mensaje (el cuerpo del reporte)
  // se crean en una sola operación atómica.
  crear(dto: CrearReporteTenantDto, tenantId: string, usuarioId: string) {
    return this.db.reporteTenant.create({
      data: {
        tenantId,
        asunto: dto.asunto,
        categoria: dto.categoria,
        usuarioId,
        mensajes: {
          create: {
            autorTipo: 'TENANT',
            autorUsuarioId: usuarioId,
            cuerpo: dto.cuerpo as object,
            adjuntoBase64: dto.adjuntoBase64,
            adjuntoNombre: dto.adjuntoNombre,
          },
        },
      },
      include: { mensajes: { select: SELECT_MENSAJE } },
    });
  }

  async listarPropios(params: { skip: number; take: number }) {
    const [datos, total] = await Promise.all([
      this.db.reporteTenant.findMany({
        orderBy: { ultimoMensajeEn: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { mensajes: { orderBy: { createdAt: 'desc' }, take: 1, select: SELECT_MENSAJE } },
      }),
      this.db.reporteTenant.count(),
    ]);
    return [datos, total] as const;
  }

  /** 404 si el ticket no existe O no pertenece a este tenant — el `findUnique` de `ReporteTenant` ya viene auto-scoped por `TenantPrismaService`. */
  async buscarPorIdOrThrow(id: string) {
    const reporte = await this.db.reporteTenant.findUnique({ where: { id } });
    if (!reporte) throw new NotFoundException('Ticket no encontrado');
    return reporte;
  }

  async listarMensajes(reporteId: string) {
    await this.buscarPorIdOrThrow(reporteId);
    return this.db.reporteTenantMensaje.findMany({ where: { reporteId }, orderBy: { createdAt: 'asc' }, select: SELECT_MENSAJE });
  }

  /**
   * Agrega un mensaje del tenant. `nuevoEstado` lo decide el service (lógica
   * de negocio, ver `ReportesTenantService.agregarMensaje`) — el repositorio
   * solo ejecuta la transacción (mensaje + `ultimoMensajeEn` + estado si
   * corresponde). 404 si el ticket no existe o no pertenece a este tenant.
   */
  async agregarMensaje(reporteId: string, dto: CrearMensajeReporteTenantDto, usuarioId: string, nuevoEstado?: 'EN_REVISION') {
    return this.db.$transaction(async (tx) => {
      const existe = await tx.reporteTenant.findUnique({ where: { id: reporteId }, select: { id: true } });
      if (!existe) throw new NotFoundException('Ticket no encontrado');

      const mensaje = await tx.reporteTenantMensaje.create({
        data: {
          reporteId,
          autorTipo: 'TENANT',
          autorUsuarioId: usuarioId,
          cuerpo: dto.cuerpo as object,
          adjuntoBase64: dto.adjuntoBase64,
          adjuntoNombre: dto.adjuntoNombre,
        },
        select: SELECT_MENSAJE,
      });

      await tx.reporteTenant.update({
        where: { id: reporteId },
        data: { ultimoMensajeEn: mensaje.createdAt, estado: nuevoEstado },
      });

      return mensaje;
    });
  }
}
