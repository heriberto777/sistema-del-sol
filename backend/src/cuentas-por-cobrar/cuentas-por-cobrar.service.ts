import { Injectable } from '@nestjs/common';
import { CuentasPorCobrarRepository } from './cuentas-por-cobrar.repository';
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
export class CuentasPorCobrarService {
  constructor(private readonly cuentasPorCobrarRepository: CuentasPorCobrarRepository) {}

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [cuentas, total] = await this.cuentasPorCobrarRepository.listar({ skip, take, busqueda: query.busqueda });

    const datos = cuentas.map((c) => {
      const dias = diasVencidoDesde(c.fechaVencimiento);
      return {
        id: c.facturaId,
        numero: c.factura.numero,
        ncf: c.factura.ncf,
        cliente: c.cliente.nombre,
        fecha: c.fecha,
        vencimiento: c.fechaVencimiento,
        total: Number(c.monto),
        pagado: Number(c.monto) - Number(c.saldo),
        pendiente: Number(c.saldo),
        diasVencido: dias,
        bucket: bucketDe(dias),
      };
    });

    return { datos, total, pagina, tamanoPagina };
  }

  async resumen() {
    const cuentas = await this.cuentasPorCobrarRepository.listarTodasPendientes();

    const buckets: Record<BucketAntiguedad, number> = { CORRIENTE: 0, D1_30: 0, D31_60: 0, D61_90: 0, D90_MAS: 0 };
    let totalCxC = 0;
    let totalVencido = 0;
    let totalPorVencer = 0;

    for (const c of cuentas) {
      const pendiente = Number(c.saldo);
      const dias = diasVencidoDesde(c.fechaVencimiento);
      buckets[bucketDe(dias)] += pendiente;
      totalCxC += pendiente;
      if (dias > 0) totalVencido += pendiente;
      else totalPorVencer += pendiente;
    }

    return { totalCxC, totalVencido, totalPorVencer, buckets };
  }
}
