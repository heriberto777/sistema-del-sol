import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TravelProviderService } from './providers/travel-provider.service';
import { OrdenVueloListado } from './providers/travel-provider.interface';

const PAGINAS_MAX = 10; // 10 * 50 = hasta 500 órdenes por corrida — suficiente para el volumen esperado en esta fase.

/**
 * Reconciliación de la cuenta compartida de Duffel — Plataforma, no
 * tenant (la cuenta es una sola para todos los tenants, ver "Los Dos
 * Pagos del Vuelo"). Duffel NO expone un endpoint de saldo del Balance
 * (confirmado contra el sandbox real: /air/balances, /balances y
 * /air/balance devuelven 404) — comparar números no es posible. Lo que
 * SÍ se puede hacer: cruzar las órdenes REALES de la cuenta contra
 * `TravelReserva.proveedorOrdenId` para detectar:
 * 1) Órdenes huérfanas — existen en Duffel pero no en ningún tenant
 *    (reservadas directo desde el dashboard de Duffel, fuera de la
 *    plataforma).
 * 2) Cancelaciones no reflejadas — Duffel ya marca `cancelled_at` pero
 *    la reserva interna sigue sin estado CANCELADA (el webhook no llegó,
 *    o se canceló manual en el dashboard de Duffel).
 * Nunca corrige nada solo — es un reporte para que un humano decida.
 */
@Injectable()
export class TravelReconciliacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly travelProviderService: TravelProviderService,
  ) {}

  async reconciliar() {
    const proveedor = this.travelProviderService.activo;
    const ordenesHuerfanas: OrdenVueloListado[] = [];
    const cancelacionesNoReflejadas: { ordenId: string; reservaId: string; tenantId: string; codigoInterno: string; canceladaEn: string }[] = [];

    let cursor: string | undefined;
    let totalOrdenesRevisadas = 0;

    for (let pagina = 0; pagina < PAGINAS_MAX; pagina++) {
      const { ordenes, cursorSiguiente } = await proveedor.listarOrdenes(cursor);
      totalOrdenesRevisadas += ordenes.length;

      for (const orden of ordenes) {
        const reserva = await this.prisma.travelReserva.findFirst({ where: { proveedorOrdenId: orden.id } });
        if (!reserva) {
          ordenesHuerfanas.push(orden);
          continue;
        }
        if (orden.canceladaEn && reserva.estado !== 'CANCELADA') {
          cancelacionesNoReflejadas.push({
            ordenId: orden.id,
            reservaId: reserva.id,
            tenantId: reserva.tenantId,
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
