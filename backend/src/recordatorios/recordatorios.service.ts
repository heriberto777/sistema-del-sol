import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

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
      include: { cliente: true },
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

      if (factura.cliente.email) {
        await this.notificacionesService.enviar({
          tenantId: factura.tenantId,
          canal: 'EMAIL',
          clave: 'factura_vencida',
          destinatario: factura.cliente.email,
          variables,
        });
      }
      if (factura.cliente.telefono) {
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
}
