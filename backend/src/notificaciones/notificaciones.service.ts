import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CanalNotificacion } from '@prisma/client';
import { NotificacionesRepository } from './notificaciones.repository';
import { EmailChannel } from './canales/email.channel';
import { WhatsAppChannel } from './canales/whatsapp.channel';
import { renderizarPlantilla } from './plantilla-renderer';
import { CotizacionEnviadaPayload, EVENTOS, FacturaCreadaPayload, StockBajoPayload } from '../event-bus/events';
import { PrismaService } from '../prisma/prisma.service';
import { CrearPlantillaDto } from './dto/crear-plantilla.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private readonly notificacionesRepository: NotificacionesRepository,
    private readonly emailChannel: EmailChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly prisma: PrismaService,
  ) {}

  async enviar(params: {
    tenantId: string;
    canal: CanalNotificacion;
    clave: string;
    destinatario: string;
    variables: Record<string, string>;
  }) {
    const plantilla = await this.notificacionesRepository.buscarPlantilla(params.tenantId, params.canal, params.clave);
    if (!plantilla?.activa) {
      this.logger.warn(`No hay plantilla activa "${params.clave}" (${params.canal}) para el tenant ${params.tenantId}`);
      return null;
    }

    const asunto = plantilla.asunto ? renderizarPlantilla(plantilla.asunto, params.variables) : undefined;
    const cuerpo = renderizarPlantilla(plantilla.cuerpo, params.variables);

    const notificacion = await this.notificacionesRepository.crearNotificacion(
      params.tenantId,
      params.canal,
      params.destinatario,
      asunto,
      cuerpo,
    );

    let enviada = true;
    if (params.canal === 'EMAIL') {
      enviada = await this.emailChannel.enviar(params.destinatario, asunto ?? '', cuerpo);
    } else if (params.canal === 'WHATSAPP') {
      enviada = await this.whatsAppChannel.enviar(params.destinatario, asunto ?? '', cuerpo);
    }

    await this.notificacionesRepository.marcarEstado(notificacion.id, enviada ? 'ENVIADA' : 'FALLIDA');
    return notificacion;
  }

  listarPlantillas(tenantId: string) {
    return this.notificacionesRepository.listarPlantillas(tenantId);
  }

  guardarPlantilla(tenantId: string, dto: CrearPlantillaDto) {
    return this.notificacionesRepository.upsertPlantilla(tenantId, dto);
  }

  async listar(tenantId: string, query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.notificacionesRepository.listarPorTenant(tenantId, {
      skip,
      take,
      busqueda: query.busqueda,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  @OnEvent(EVENTOS.FACTURA_CREADA)
  async alFacturarse(payload: FacturaCreadaPayload) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: payload.clienteId } });
    if (!cliente) return;

    const variables = { cliente_nombre: cliente.nombre, factura_total: payload.total };

    if (cliente.email) {
      await this.enviar({ tenantId: payload.tenantId, canal: 'EMAIL', clave: 'factura_creada', destinatario: cliente.email, variables });
    }
    // Por WhatsApp solo se envía si el tenant configuró una plantilla
    // WHATSAPP para "factura_creada" — enviar() no hace nada si no existe
    // una plantilla activa, así que esto es un no-op silencioso por defecto.
    if (cliente.telefono) {
      await this.enviar({ tenantId: payload.tenantId, canal: 'WHATSAPP', clave: 'factura_creada', destinatario: cliente.telefono, variables });
    }
  }

  @OnEvent(EVENTOS.COTIZACION_ENVIADA)
  async alEnviarCotizacion(payload: CotizacionEnviadaPayload) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: payload.clienteId } });
    if (!cliente) return;

    const variables = { cliente_nombre: cliente.nombre, cotizacion_numero: payload.numero, cotizacion_total: payload.total };

    if (cliente.email) {
      await this.enviar({ tenantId: payload.tenantId, canal: 'EMAIL', clave: 'cotizacion_enviada', destinatario: cliente.email, variables });
    }
    if (cliente.telefono) {
      await this.enviar({ tenantId: payload.tenantId, canal: 'WHATSAPP', clave: 'cotizacion_enviada', destinatario: cliente.telefono, variables });
    }
  }

  @OnEvent(EVENTOS.STOCK_BAJO)
  async alBajarStock(payload: StockBajoPayload) {
    const admins = await this.prisma.user.findMany({
      where: { tenantId: payload.tenantId, roles: { some: { role: { nombre: { in: ['Admin Total', 'Almacenero'] } } } } },
    });

    for (const admin of admins) {
      await this.enviar({
        tenantId: payload.tenantId,
        canal: 'EMAIL',
        clave: 'stock_bajo',
        destinatario: admin.email,
        variables: {
          producto_id: payload.productoId,
          cantidad_actual: payload.cantidadActual,
          stock_minimo: payload.stockMinimo,
        },
      });
    }
  }
}
