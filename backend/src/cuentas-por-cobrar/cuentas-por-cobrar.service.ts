import { Injectable } from '@nestjs/common';
import { CuentasPorCobrarRepository } from './cuentas-por-cobrar.repository';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export type BucketAntiguedad = 'CORRIENTE' | 'D1_30' | 'D31_60' | 'D61_90' | 'D90_MAS';

/** Mismo cálculo de vencimiento que RecordatoriosService (fecha + plazoPagoDias) — una sola fórmula para no divergir. */
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
export class CuentasPorCobrarService {
  constructor(private readonly cuentasPorCobrarRepository: CuentasPorCobrarRepository) {}

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [facturas, total] = await this.cuentasPorCobrarRepository.listar({ skip, take, busqueda: query.busqueda });
    const pagadoPorFactura = await this.mapaPagadoPorFactura(facturas.map((f) => f.id));

    const datos = facturas.map((f) => {
      const pagado = pagadoPorFactura.get(f.id) ?? 0;
      const dias = diasVencido(f.fecha, f.plazoPagoDias);
      return {
        id: f.id,
        numero: f.numero,
        ncf: f.ncf,
        cliente: f.cliente.nombre,
        fecha: f.fecha,
        vencimiento: new Date(f.fecha.getTime() + f.plazoPagoDias * MS_POR_DIA),
        total: Number(f.total),
        pagado,
        pendiente: Number(f.total) - pagado,
        diasVencido: dias,
        bucket: bucketDe(dias),
      };
    });

    return { datos, total, pagina, tamanoPagina };
  }

  async resumen() {
    const facturas = await this.cuentasPorCobrarRepository.listarTodasPendientes();
    const pagadoPorFactura = await this.mapaPagadoPorFactura(facturas.map((f) => f.id));

    const buckets: Record<BucketAntiguedad, number> = { CORRIENTE: 0, D1_30: 0, D31_60: 0, D61_90: 0, D90_MAS: 0 };
    let totalCxC = 0;
    let totalVencido = 0;
    let totalPorVencer = 0;

    for (const f of facturas) {
      const pendiente = Number(f.total) - (pagadoPorFactura.get(f.id) ?? 0);
      const dias = diasVencido(f.fecha, f.plazoPagoDias);
      buckets[bucketDe(dias)] += pendiente;
      totalCxC += pendiente;
      if (dias > 0) totalVencido += pendiente;
      else totalPorVencer += pendiente;
    }

    return { totalCxC, totalVencido, totalPorVencer, buckets };
  }

  private async mapaPagadoPorFactura(facturaIds: string[]): Promise<Map<string | null, number>> {
    const pagos = await this.cuentasPorCobrarRepository.sumaPagosPorFacturas(facturaIds);
    return new Map(pagos.map((p) => [p.facturaId, Number(p._sum.monto ?? 0)]));
  }
}
