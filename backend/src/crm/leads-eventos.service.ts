import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { moduloEstaActivo } from '../planes/resolver-modulos-activos';
import { EVENTOS, ConsultaProductoDesconocidoPayload } from '../event-bus/events';

const DESCRIPCION_ORIGEN: Record<ConsultaProductoDesconocidoPayload['origen'], string> = {
  WHATSAPP: 'vía WhatsApp',
  TIENDA: 'en la Tienda Online',
};

/** `OrigenLead` real del catálogo del Lead — "TIENDA" no es un valor propio del enum, mapea a FORMULARIO_WEB (ver schema.prisma). */
const ORIGEN_LEAD: Record<ConsultaProductoDesconocidoPayload['origen'], 'WHATSAPP' | 'FORMULARIO_WEB'> = {
  WHATSAPP: 'WHATSAPP',
  TIENDA: 'FORMULARIO_WEB',
};

/**
 * CRM "Cotización conectada" Fase 2 — corre fuera de contexto HTTP (Event
 * Bus), `PrismaService` global + `tenantId` explícito, nunca
 * `TenantPrismaService` (mismo criterio que OportunidadesEventosService).
 */
@Injectable()
export class LeadsEventosService {
  private readonly logger = new Logger(LeadsEventosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Busca al Admin Total más antiguo del tenant — mismo patrón ya usado para acciones sin un usuario real detrás (ver EcommerceRepository.buscarAdminMasAntiguo). */
  private buscarAdminMasAntiguo(tenantId: string) {
    return this.prisma.user.findFirst({
      where: { tenantId, roles: { some: { role: { nombre: 'Admin Total' } } } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
  }

  @OnEvent(EVENTOS.CONSULTA_PRODUCTO_DESCONOCIDO)
  async alConsultarProductoDesconocido(payload: ConsultaProductoDesconocidoPayload) {
    if (!(await moduloEstaActivo(this.prisma, payload.tenantId, 'crm'))) return;

    // Dedup por teléfono — el mismo desconocido puede preguntar más de una
    // vez (otro producto, otro canal); reusa el Lead en vez de duplicarlo.
    let lead = await this.prisma.lead.findFirst({ where: { tenantId: payload.tenantId, telefono: payload.telefono } });

    const admin = await this.buscarAdminMasAntiguo(payload.tenantId);
    if (!lead) {
      if (!admin) {
        this.logger.warn(`Tenant ${payload.tenantId} sin ningún Admin Total — no se puede crear el Lead ni registrar la actividad`);
        return;
      }
      lead = await this.prisma.lead.create({
        data: {
          tenantId: payload.tenantId,
          nombre: payload.nombre?.trim() || payload.telefono,
          telefono: payload.telefono,
          origen: ORIGEN_LEAD[payload.origen],
        },
      });
    }

    const usuarioId = lead.vendedorId ?? admin?.id;
    if (!usuarioId) return;

    await this.prisma.actividadCrm.create({
      data: {
        tenantId: payload.tenantId,
        tipo: 'NOTA',
        descripcion: `Preguntó por "${payload.productoNombre}" ${DESCRIPCION_ORIGEN[payload.origen]}.`,
        leadId: lead.id,
        usuarioId,
        completada: true,
      },
    });
  }
}
