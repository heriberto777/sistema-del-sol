import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { moduloEstaActivo } from '../planes/resolver-modulos-activos';
import { EVENTOS, ConsultaProductoDesconocidoPayload, WhatsappPedidoSugeridoPayload } from '../event-bus/events';

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

  /**
   * CRM "Cotización conectada" Fase 3 — a diferencia de
   * `alConsultarProductoDesconocido`, esto SÍ chequea si ya es un Cliente
   * real primero: si lo es, la actividad se cuelga directo de
   * `clienteId` (el vendedor la ve en el timeline del cliente y puede
   * generar la cotización ya mismo, prellenada con estas líneas). Si
   * todavía es un Lead (o uno nuevo), queda en `leadId` — ahí el vendedor
   * solo puede LEER la sugerencia (no se puede generar una Cotización
   * real sin un Cliente, `Cotizacion.clienteId` es obligatorio) hasta
   * convertirlo. Nunca crea ni modifica ninguna Cotización/Oportunidad
   * por su cuenta — es un borrador de solo lectura hasta que un vendedor
   * actúa.
   */
  @OnEvent(EVENTOS.WHATSAPP_PEDIDO_SUGERIDO)
  async alSugerirPedidoWhatsapp(payload: WhatsappPedidoSugeridoPayload) {
    if (!(await moduloEstaActivo(this.prisma, payload.tenantId, 'crm'))) return;

    const descripcionLineas = payload.lineas.map((l) => `${l.cantidad}x ${l.nombre}`).join(', ');
    const descripcion = `Pedido sugerido por WhatsApp (sin confirmar — revisá antes de generar la cotización): ${descripcionLineas}.`;
    const lineasSugeridas = payload.lineas as unknown as Prisma.InputJsonValue;

    const cliente = await this.prisma.cliente.findFirst({ where: { tenantId: payload.tenantId, telefono: payload.telefono } });
    const admin = await this.buscarAdminMasAntiguo(payload.tenantId);

    if (cliente) {
      if (!admin) {
        this.logger.warn(`Tenant ${payload.tenantId} sin ningún Admin Total — no se puede registrar la actividad del pedido sugerido`);
        return;
      }
      await this.prisma.actividadCrm.create({
        data: { tenantId: payload.tenantId, tipo: 'TAREA', descripcion, clienteId: cliente.id, usuarioId: admin.id, fechaProgramada: new Date(), lineasSugeridas },
      });
      return;
    }

    let lead = await this.prisma.lead.findFirst({ where: { tenantId: payload.tenantId, telefono: payload.telefono } });
    if (!lead) {
      if (!admin) {
        this.logger.warn(`Tenant ${payload.tenantId} sin ningún Admin Total — no se puede crear el Lead del pedido sugerido`);
        return;
      }
      lead = await this.prisma.lead.create({
        data: { tenantId: payload.tenantId, nombre: payload.nombre?.trim() || payload.telefono, telefono: payload.telefono, origen: 'WHATSAPP' },
      });
    }
    const usuarioId = lead.vendedorId ?? admin?.id;
    if (!usuarioId) return;

    await this.prisma.actividadCrm.create({
      data: { tenantId: payload.tenantId, tipo: 'TAREA', descripcion, leadId: lead.id, usuarioId, fechaProgramada: new Date(), lineasSugeridas },
    });
  }
}
