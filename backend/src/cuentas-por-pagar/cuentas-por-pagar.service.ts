import { Injectable } from '@nestjs/common';
import { CuentasPorPagarRepository } from './cuentas-por-pagar.repository';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export type BucketAntiguedad = 'CORRIENTE' | 'D1_30' | 'D31_60' | 'D61_90' | 'D90_MAS';

/** Mismo cálculo que CuentasPorCobrarService — una sola fórmula para no divergir. */
function diasVencido(fecha: Date, plazoPagoDias: number): number {
  const vencimiento = fecha.getTime() + plazoPagoDias * MS_POR_DIA;
  return Math.floor((Date.now() - vencimiento) / MS_POR_DIA);
}

function bucketDe(dias: number): BucketAntiguedad {
  if (dias <= 0) return 'CORRIENTE';
  if (dias <= 30) return 'D1_30';
  if (dias <= 60) return 'D31_60';
  if (dias <= 90) return 'D61_90';
  return 'D90_MAS';
}

@Injectable()
export class CuentasPorPagarService {
  constructor(private readonly cuentasPorPagarRepository: CuentasPorPagarRepository) {}

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [ordenes, total] = await this.cuentasPorPagarRepository.listar({ skip, take, busqueda: query.busqueda });
    const pagadoPorOrden = await this.mapaPagadoPorOrden(ordenes.map((o) => o.id));

    const datos = ordenes.map((o) => {
      const pagado = pagadoPorOrden.get(o.id) ?? 0;
      const dias = diasVencido(o.fecha, o.proveedor.plazoPagoDias);
      return {
        id: o.id,
        numero: o.numero,
        proveedor: o.proveedor.nombre,
        fecha: o.fecha,
        vencimiento: new Date(o.fecha.getTime() + o.proveedor.plazoPagoDias * MS_POR_DIA),
        total: Number(o.total),
        pagado,
        pendiente: Number(o.total) - pagado,
        diasVencido: dias,
        bucket: bucketDe(dias),
      };
    });

    return { datos, total, pagina, tamanoPagina };
  }

  async resumen() {
    const ordenes = await this.cuentasPorPagarRepository.listarTodasPendientes();
    const pagadoPorOrden = await this.mapaPagadoPorOrden(ordenes.map((o) => o.id));

    const buckets: Record<BucketAntiguedad, number> = { CORRIENTE: 0, D1_30: 0, D31_60: 0, D61_90: 0, D90_MAS: 0 };
    let totalCxP = 0;
    let totalVencido = 0;
    let totalPorVencer = 0;

    for (const o of ordenes) {
      const pendiente = Number(o.total) - (pagadoPorOrden.get(o.id) ?? 0);
      const dias = diasVencido(o.fecha, o.proveedor.plazoPagoDias);
      buckets[bucketDe(dias)] += pendiente;
      totalCxP += pendiente;
      if (dias > 0) totalVencido += pendiente;
      else totalPorVencer += pendiente;
    }

    return { totalCxP, totalVencido, totalPorVencer, buckets };
  }

  private async mapaPagadoPorOrden(ordenIds: string[]): Promise<Map<string | null, number>> {
    const pagos = await this.cuentasPorPagarRepository.sumaPagosPorOrdenes(ordenIds);
    return new Map(pagos.map((p) => [p.ordenCompraId, Number(p._sum.monto ?? 0)]));
  }
}
