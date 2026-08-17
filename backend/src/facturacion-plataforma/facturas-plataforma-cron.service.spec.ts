import { FacturasPlataformaCronService } from './facturas-plataforma-cron.service';
import { SuscripcionesRepository } from './suscripciones.repository';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { FacturasPlataformaService } from './facturas-plataforma.service';

describe('FacturasPlataformaCronService', () => {
  let cron: FacturasPlataformaCronService;
  let suscripcionesRepo: jest.Mocked<SuscripcionesRepository>;
  let facturasRepo: jest.Mocked<FacturasPlataformaRepository>;
  let facturasService: jest.Mocked<FacturasPlataformaService>;

  beforeEach(() => {
    suscripcionesRepo = {
      listarActivasParaFacturar: jest.fn().mockResolvedValue([]),
      avanzarProximoCorte: jest.fn(),
    } as unknown as jest.Mocked<SuscripcionesRepository>;
    facturasRepo = { listarVencidasPendientes: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<FacturasPlataformaRepository>;
    facturasService = {
      generarDesdeSuscripcion: jest.fn(),
      marcarVencidaConMora: jest.fn(),
    } as unknown as jest.Mocked<FacturasPlataformaService>;
    cron = new FacturasPlataformaCronService(suscripcionesRepo, facturasRepo, facturasService);
  });

  describe('generarFacturasDelDia', () => {
    it('genera una factura por cada suscripción activa vencida y avanza su próximo corte según el ciclo del plan', async () => {
      suscripcionesRepo.listarActivasParaFacturar.mockResolvedValue([
        { id: 's1', fechaProximoCorte: new Date('2026-01-15T00:00:00Z'), plan: { cicloFacturacion: 'MENSUAL' } },
        { id: 's2', fechaProximoCorte: new Date('2026-01-15T00:00:00Z'), plan: { cicloFacturacion: 'ANUAL' } },
      ] as never);

      const total = await cron.generarFacturasDelDia();

      expect(total).toBe(2);
      expect(facturasService.generarDesdeSuscripcion).toHaveBeenCalledTimes(2);
      const [, fechaMensual] = suscripcionesRepo.avanzarProximoCorte.mock.calls[0];
      expect(fechaMensual.toISOString()).toContain('2026-02-15');
      const [, fechaAnual] = suscripcionesRepo.avanzarProximoCorte.mock.calls[1];
      expect(fechaAnual.toISOString()).toContain('2027-01-15');
    });

    it('no hace nada si no hay suscripciones vencidas', async () => {
      const total = await cron.generarFacturasDelDia();
      expect(total).toBe(0);
      expect(facturasService.generarDesdeSuscripcion).not.toHaveBeenCalled();
    });
  });

  describe('marcarVencidasYAplicarMora', () => {
    it('aplica mora a cada factura PENDIENTE vencida usando el feeMoraPct de su suscripción', async () => {
      facturasRepo.listarVencidasPendientes.mockResolvedValue([
        { id: 'f1', suscripcion: { feeMoraPct: 5 } },
        { id: 'f2', suscripcion: { feeMoraPct: 10 } },
      ] as never);

      const total = await cron.marcarVencidasYAplicarMora();

      expect(total).toBe(2);
      expect(facturasService.marcarVencidaConMora).toHaveBeenCalledWith('f1', 5);
      expect(facturasService.marcarVencidaConMora).toHaveBeenCalledWith('f2', 10);
    });
  });
});
