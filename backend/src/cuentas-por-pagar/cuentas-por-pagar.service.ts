import { Injectable } from '@nestjs/common';
import { CuentasPorPagarRepository } from './cuentas-por-pagar.repository';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { diasVencidoDesde } from '../common/fecha/dias-vencido.util';

export type BucketAntiguedad = 'CORRIENTE' | 'D1_30' | 'D31_60' | 'D61_90' | 'D90_MAS';

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

    // Una orden puede tener varias CuentaPorPagar abiertas (una por cada
    // recepción parcial todavía no pagada) — se suman acá porque `Pago`
    // sigue pagando la orden completa (Fase 3 lo separa); la fecha de
    // vencimiento mostrada es la más antigua (la más urgente).
    const datos = ordenes.map((o) => {
      const monto = o.cuentasPorPagar.reduce((acc, c) => acc + Number(c.monto), 0);
      const saldo = o.cuentasPorPagar.reduce((acc, c) => acc + Number(c.saldo), 0);
      const fechaVencimiento = o.cuentasPorPagar.reduce(
        (min, c) => (c.fechaVencimiento < min ? c.fechaVencimiento : min),
        o.cuentasPorPagar[0].fechaVencimiento,
      );
      const dias = diasVencidoDesde(fechaVencimiento);
      return {
        id: o.id,
        numero: o.numero,
        proveedor: o.proveedor.nombre,
        fecha: o.fecha,
        vencimiento: fechaVencimiento,
        total: monto,
        pagado: monto - saldo,
        pendiente: saldo,
        diasVencido: dias,
        bucket: bucketDe(dias),
      };
    });

    return { datos, total, pagina, tamanoPagina };
  }

  async resumen() {
    const cuentas = await this.cuentasPorPagarRepository.listarTodasPendientes();

    const buckets: Record<BucketAntiguedad, number> = { CORRIENTE: 0, D1_30: 0, D31_60: 0, D61_90: 0, D90_MAS: 0 };
    let totalCxP = 0;
    let totalVencido = 0;
    let totalPorVencer = 0;

    for (const c of cuentas) {
      const pendiente = Number(c.saldo);
      const dias = diasVencidoDesde(c.fechaVencimiento);
      buckets[bucketDe(dias)] += pendiente;
      totalCxP += pendiente;
      if (dias > 0) totalVencido += pendiente;
      else totalPorVencer += pendiente;
    }

    return { totalCxP, totalVencido, totalPorVencer, buckets };
  }
}
