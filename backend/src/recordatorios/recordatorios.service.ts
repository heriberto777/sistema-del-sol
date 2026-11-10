import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TipoDocumentoComentario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CLIENTE_SELECT_BASICO } from '../common/prisma/cliente-select-basico';
import { ETIQUETA_TIPO_DOCUMENTO } from '../comentarios-documento/tipo-documento';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

@Injectable()
export class RecordatoriosService {
  private readonly logger = new Logger(RecordatoriosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /**
   * Corre fuera de cualquier contexto de tenant (es un cron, no un
   * request), así que usa el PrismaService global y filtra por tenantId
   * a mano — igual que los listeners de NotificacionesService.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async enviarRecordatoriosDeCobro() {
    const facturasCredito = await this.prisma.factura.findMany({
      where: { estado: 'EMITIDA', tipoFactura: 'CREDITO', pagada: false },
      // CLIENTE_SELECT_BASICO no trae notificaciones*Habilitadas (solo
      // CLIENTE_SELECT_COMPLETO) — se extiende acá en vez de tocar el
      // select compartido, que usan endpoints que no necesitan ese dato.
      include: { cliente: { select: { ...CLIENTE_SELECT_BASICO, notificacionesEmailHabilitadas: true, notificacionesWhatsappHabilitadas: true } } },
    });

    const ahora = Date.now();
    const vencidas = facturasCredito.filter(
      (f) => f.fecha.getTime() + f.plazoPagoDias * MS_POR_DIA < ahora,
    );

    this.logger.log(`Recordatorios de cobro: ${vencidas.length} factura(s) vencida(s) sin pagar`);

    for (const factura of vencidas) {
      const variables = {
        cliente_nombre: factura.cliente.nombre,
        factura_ncf: factura.ncf ?? '',
        factura_total: factura.total.toString(),
      };

      // === false explícito, no `!cliente.notificaciones*Habilitadas` —
      // mismo criterio que NotificacionesService.alFacturarse/alEnviarCotizacion,
      // ver el comentario ahí.
      if (factura.cliente.email && factura.cliente.notificacionesEmailHabilitadas !== false) {
        await this.notificacionesService.enviar({
          tenantId: factura.tenantId,
          canal: 'EMAIL',
          clave: 'factura_vencida',
          destinatario: factura.cliente.email,
          variables,
        });
      }
      if (factura.cliente.telefono && factura.cliente.notificacionesWhatsappHabilitadas !== false) {
        await this.notificacionesService.enviar({
          tenantId: factura.tenantId,
          canal: 'WHATSAPP',
          clave: 'factura_vencida',
          destinatario: factura.cliente.telefono,
          variables,
        });
      }
    }

    return vencidas.length;
  }

  /**
   * Fase 11.2 del benchmark — recordatorio opcional de un comentario en
   * Factura/Cotización. Avisa a `mencionado ?? autor` (un comentario sin
   * mención es un recordatorio personal del propio autor). `documentoId`
   * es texto libre sin FK (ver el modelo en schema.prisma) — se resuelve
   * la etiqueta (NCF/número) acá mismo contra `PrismaService` global,
   * mismo criterio que el resto de este cron (sin TenantPrismaService,
   * fuera de contexto de request).
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async enviarRecordatoriosDeComentarios() {
    const pendientes = await this.prisma.comentarioDocumento.findMany({
      where: { recordatorioEnviado: false, fechaRecordatorio: { lte: new Date() } },
      include: { autor: true, mencionado: true },
    });

    this.logger.log(`Recordatorios de comentarios: ${pendientes.length} pendiente(s)`);

    for (const comentario of pendientes) {
      const destinatario = comentario.mencionado ?? comentario.autor;
      const variables = {
        tipo_documento_etiqueta: ETIQUETA_TIPO_DOCUMENTO[comentario.tipoDocumento],
        documento_etiqueta: await this.resolverEtiquetaDocumento(comentario.tipoDocumento, comentario.documentoId),
        texto: comentario.texto,
      };

      await this.notificacionesService.enviar({
        tenantId: comentario.tenantId,
        canal: 'EMAIL',
        clave: 'comentario_documento_recordatorio',
        destinatario: destinatario.email,
        variables,
      });
      if (destinatario.telefono) {
        await this.notificacionesService.enviar({
          tenantId: comentario.tenantId,
          canal: 'WHATSAPP',
          clave: 'comentario_documento_recordatorio',
          destinatario: destinatario.telefono,
          variables,
        });
      }

      await this.prisma.comentarioDocumento.update({ where: { id: comentario.id }, data: { recordatorioEnviado: true } });
    }

    return pendientes.length;
  }

  private async resolverEtiquetaDocumento(tipoDocumento: TipoDocumentoComentario, documentoId: string): Promise<string> {
    if (tipoDocumento === 'FACTURA') {
      const factura = await this.prisma.factura.findUnique({ where: { id: documentoId }, select: { ncf: true } });
      return factura?.ncf ?? '';
    }
    const cotizacion = await this.prisma.cotizacion.findUnique({ where: { id: documentoId }, select: { numero: true } });
    return cotizacion?.numero ?? '';
  }
}
