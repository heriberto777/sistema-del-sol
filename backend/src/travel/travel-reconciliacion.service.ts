import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TravelProviderService } from './providers/travel-provider.service';
import { OrdenVueloListado } from './providers/travel-provider.interface';
import { TravelConfigService } from '../travel-config/travel-config.service';

const PAGINAS_MAX = 10;

/**
 * Reconciliación de la cuenta de Duffel de ESTE tenant — antes era un
 * endpoint de Plataforma contra la cuenta única y compartida; con
 * credenciales por tenant, cada uno audita su propia cuenta (ver
 * TravelConfigService.obtenerCredencialesDuffel, sin fallback a nada
 * compartido). Nunca corrige nada automáticamente, solo reporta.
 */
@Injectable()
export class TravelReconciliacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly travelProviderService: TravelProviderService,
    private readonly travelConfigService: TravelConfigService,
  ) {}

  async reconciliar(tenantId: string) {
    const credenciales = await this.travelConfigService.obtenerCredencialesDuffel(tenantId);
    const proveedor = this.travelProviderService.activo;
    const ordenesHuerfanas: OrdenVueloListado[] = [];
    const cancelacionesNoReflejadas: { ordenId: string; reservaId: string; codigoInterno: string; canceladaEn: string }[] = [];

    let cursor: string | undefined;
    let totalOrdenesRevisadas = 0;

    for (let pagina = 0; pagina < PAGINAS_MAX; pagina++) {
      const { ordenes, cursorSiguiente } = await proveedor.listarOrdenes(credenciales, cursor);
      totalOrdenesRevisadas += ordenes.length;

      for (const orden of ordenes) {
        const reserva = await this.prisma.travelReserva.findFirst({ where: { tenantId, proveedorOrdenId: orden.id } });
        if (!reserva) {
          ordenesHuerfanas.push(orden);
          continue;
        }
        if (orden.canceladaEn && reserva.estado !== 'CANCELADA') {
          cancelacionesNoReflejadas.push({
            ordenId: orden.id,
            reservaId: reserva.id,
            codigoInterno: reserva.codigoInterno,
            canceladaEn: orden.canceladaEn,
          });
        }
      }

      if (!cursorSiguiente || ordenes.length === 0) break;
      cursor = cursorSiguiente;
    }

    return { totalOrdenesRevisadas, ordenesHuerfanas, cancelacionesNoReflejadas };
  }
}
