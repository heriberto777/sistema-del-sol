import { Injectable } from '@nestjs/common';
import { EstadoLead } from '@prisma/client';
import { CrmReportesRepository } from './crm-reportes.repository';

const ESTADOS_LEAD: EstadoLead[] = ['NUEVO', 'CONTACTADO', 'CALIFICADO', 'DESCARTADO', 'CONVERTIDO'];
const MS_POR_DIA = 1000 * 60 * 60 * 24;

@Injectable()
export class CrmReportesService {
  constructor(private readonly crmReportesRepository: CrmReportesRepository) {}

  /** Sin desde/hasta toma el mes en curso — mismo criterio que CotizacionesService.resumenConversion. */
  async dashboard(desde?: string, hasta?: string) {
    const hastaFecha = hasta ? new Date(hasta) : new Date();
    const desdeFecha = desde ? new Date(desde) : new Date(hastaFecha.getFullYear(), hastaFecha.getMonth(), 1);

    const [leadsPorEstado, pipelineAbierto, ganadas, perdidas, oportunidadesCerradas, oportunidadesAbiertas, rankingVendedores] = await Promise.all([
      this.crmReportesRepository.contarLeadsPorEstado(),
      this.crmReportesRepository.resumenOportunidadesAbiertas(),
      this.crmReportesRepository.resumenCerradas('GANADA', desdeFecha, hastaFecha),
      this.crmReportesRepository.resumenCerradas('PERDIDA', desdeFecha, hastaFecha),
      this.crmReportesRepository.gananciasParaCiclo(desdeFecha, hastaFecha),
      this.crmReportesRepository.oportunidadesAbiertasParaForecast(),
      this.crmReportesRepository.rankingVendedores(desdeFecha, hastaFecha),
    ]);

    const embudoLeads = Object.fromEntries(ESTADOS_LEAD.map((estado) => [estado, 0])) as Record<EstadoLead, number>;
    for (const fila of leadsPorEstado) embudoLeads[fila.estado] = fila._count._all;

    const totalCerradas = ganadas.cantidad + perdidas.cantidad;
    const tasaConversion = totalCerradas > 0 ? ganadas.cantidad / totalCerradas : null;

    const cicloPromedioDias =
      oportunidadesCerradas.length > 0
        ? oportunidadesCerradas.reduce((acc, o) => acc + (o.fechaCierreReal!.getTime() - o.createdAt.getTime()), 0) / oportunidadesCerradas.length / MS_POR_DIA
        : null;

    const forecastPorMesMap = new Map<string, number>();
    for (const o of oportunidadesAbiertas) {
      const mes = o.fechaCierreEstimada.toISOString().slice(0, 7);
      const ponderado = Number(o.montoEstimado) * (o.probabilidadPct / 100);
      forecastPorMesMap.set(mes, (forecastPorMesMap.get(mes) ?? 0) + ponderado);
    }
    const forecastPorMes = Array.from(forecastPorMesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, montoPonderado]) => ({ mes, montoPonderado }));

    return { pipelineAbierto, ganadas, perdidas, tasaConversion, cicloPromedioDias, embudoLeads, forecastPorMes, rankingVendedores };
  }
}
