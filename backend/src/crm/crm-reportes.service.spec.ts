import { CrmReportesService } from './crm-reportes.service';
import { CrmReportesRepository } from './crm-reportes.repository';

describe('CrmReportesService', () => {
  let repository: jest.Mocked<CrmReportesRepository>;
  let service: CrmReportesService;

  beforeEach(() => {
    repository = {
      contarLeadsPorEstado: jest.fn().mockResolvedValue([]),
      resumenOportunidadesAbiertas: jest.fn().mockResolvedValue({ cantidad: 0, montoTotal: 0 }),
      resumenCerradas: jest.fn().mockResolvedValue({ cantidad: 0, montoTotal: 0 }),
      gananciasParaCiclo: jest.fn().mockResolvedValue([]),
      oportunidadesAbiertasParaForecast: jest.fn().mockResolvedValue([]),
      rankingVendedores: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<CrmReportesRepository>;
    service = new CrmReportesService(repository);
  });

  it('rellena con 0 los estados de Lead que no tuvieron ninguna fila ese período', async () => {
    repository.contarLeadsPorEstado.mockResolvedValue([{ estado: 'NUEVO', _count: { _all: 5 } }] as never);

    const resultado = await service.dashboard();

    expect(resultado.embudoLeads).toEqual({ NUEVO: 5, CONTACTADO: 0, CALIFICADO: 0, DESCARTADO: 0, CONVERTIDO: 0 });
  });

  it('calcula la tasa de conversión sobre el total de oportunidades cerradas (ganadas + perdidas)', async () => {
    repository.resumenCerradas.mockImplementation(async (estado) =>
      estado === 'GANADA' ? { cantidad: 3, montoTotal: 9000 } : { cantidad: 1, montoTotal: 1000 },
    );

    const resultado = await service.dashboard();

    expect(resultado.tasaConversion).toBe(0.75);
  });

  it('devuelve tasaConversion null si no hubo ninguna oportunidad cerrada en el período', async () => {
    const resultado = await service.dashboard();

    expect(resultado.tasaConversion).toBeNull();
  });

  it('calcula el ciclo promedio de venta en días a partir de createdAt/fechaCierreReal', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const fechaCierreReal = new Date('2026-01-11T00:00:00Z'); // 10 días
    repository.gananciasParaCiclo.mockResolvedValue([{ createdAt, fechaCierreReal }] as never);

    const resultado = await service.dashboard();

    expect(resultado.cicloPromedioDias).toBe(10);
  });

  it('pondera el forecast por mes según probabilidadPct y agrupa por mes de fechaCierreEstimada', async () => {
    repository.oportunidadesAbiertasParaForecast.mockResolvedValue([
      { fechaCierreEstimada: new Date('2026-12-05T00:00:00Z'), montoEstimado: '1000', probabilidadPct: 50 },
      { fechaCierreEstimada: new Date('2026-12-20T00:00:00Z'), montoEstimado: '2000', probabilidadPct: 25 },
      { fechaCierreEstimada: new Date('2027-01-10T00:00:00Z'), montoEstimado: '4000', probabilidadPct: 100 },
    ] as never);

    const resultado = await service.dashboard();

    expect(resultado.forecastPorMes).toEqual([
      { mes: '2026-12', montoPonderado: 1000 }, // 1000*0.5 + 2000*0.25
      { mes: '2027-01', montoPonderado: 4000 },
    ]);
  });
});
