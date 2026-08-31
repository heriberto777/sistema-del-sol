import { FacturasPlataformaCronService } from './facturas-plataforma-cron.service';
import { SuscripcionesRepository } from './suscripciones.repository';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { FacturasPlataformaService } from './facturas-plataforma.service';
import { ReglasNotificacionRepository } from './reglas-notificacion/reglas-notificacion.repository';

describe('FacturasPlataformaCronService', () => {
  let cron: FacturasPlataformaCronService;
  let suscripcionesRepo: jest.Mocked<SuscripcionesRepository>;
  let facturasRepo: jest.Mocked<FacturasPlataformaRepository>;
  let facturasService: jest.Mocked<FacturasPlataformaService>;
  let reglasNotificacionRepo: jest.Mocked<ReglasNotificacionRepository>;

  beforeEach(() => {
    suscripcionesRepo = {
      listarActivasParaFacturar: jest.fn().mockResolvedValue([]),
      avanzarProximoCorte: jest.fn(),
    } as unknown as jest.Mocked<SuscripcionesRepository>;
    facturasRepo = {
      listarVencidasPendientes: jest.fn().mockResolvedValue([]),
      listarPendientesOVencidas: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<FacturasPlataformaRepository>;
    facturasService = {
      generarDesdeSuscripcion: jest.fn(),
      marcarVencidaConMora: jest.fn(),
      notificarPorRegla: jest.fn(),
    } as unknown as jest.Mocked<FacturasPlataformaService>;
    reglasNotificacionRepo = {
      listarActivas: jest.fn().mockResolvedValue([]),
      yaFueEnviada: jest.fn().mockResolvedValue(null),
      registrarEnviada: jest.fn(),
    } as unknown as jest.Mocked<ReglasNotificacionRepository>;
    cron = new FacturasPlataformaCronService(suscripcionesRepo, facturasRepo, facturasService, reglasNotificacionRepo);
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

  describe('enviarNotificacionesVencimiento (Fase 4)', () => {
    const MS_POR_DIA = 24 * 60 * 60 * 1000;

    it('despacha el aviso cuando hoy coincide con fechaVencimiento + offsetDias de una regla activa', async () => {
      const hoy = new Date();
      // offsetDias: -3 -> fechaObjetivo = fechaVencimiento - 3 días = hoy  =>  fechaVencimiento = hoy + 3 días
      const fechaVencimiento = new Date(hoy.getTime() + 3 * MS_POR_DIA);
      facturasRepo.listarPendientesOVencidas.mockResolvedValue([{ id: 'f1', fechaVencimiento }] as never);
      reglasNotificacionRepo.listarActivas.mockResolvedValue([{ id: 'r1', offsetDias: -3, canal: 'EMAIL' }] as never);

      const total = await cron.enviarNotificacionesVencimiento();

      expect(total).toBe(1);
      expect(facturasService.notificarPorRegla).toHaveBeenCalledWith('f1', -3, 'EMAIL');
      expect(reglasNotificacionRepo.registrarEnviada).toHaveBeenCalledWith('f1', 'r1');
    });

    it('no despacha si la fecha objetivo de la regla no es hoy', async () => {
      const hoy = new Date();
      const fechaVencimiento = new Date(hoy.getTime() + 30 * MS_POR_DIA);
      facturasRepo.listarPendientesOVencidas.mockResolvedValue([{ id: 'f1', fechaVencimiento }] as never);
      reglasNotificacionRepo.listarActivas.mockResolvedValue([{ id: 'r1', offsetDias: -3, canal: 'EMAIL' }] as never);

      const total = await cron.enviarNotificacionesVencimiento();

      expect(total).toBe(0);
      expect(facturasService.notificarPorRegla).not.toHaveBeenCalled();
    });

    it('no reenvía si ya existe una NotificacionVencimientoEnviada para ese par (idempotencia)', async () => {
      const hoy = new Date();
      const fechaVencimiento = new Date(hoy.getTime() + 3 * MS_POR_DIA);
      facturasRepo.listarPendientesOVencidas.mockResolvedValue([{ id: 'f1', fechaVencimiento }] as never);
      reglasNotificacionRepo.listarActivas.mockResolvedValue([{ id: 'r1', offsetDias: -3, canal: 'EMAIL' }] as never);
      reglasNotificacionRepo.yaFueEnviada.mockResolvedValue({ id: 'n1' } as never);

      const total = await cron.enviarNotificacionesVencimiento();

      expect(total).toBe(0);
      expect(facturasService.notificarPorRegla).not.toHaveBeenCalled();
      expect(reglasNotificacionRepo.registrarEnviada).not.toHaveBeenCalled();
    });

    it('evalúa cada factura contra cada regla activa (producto cartesiano)', async () => {
      const hoy = new Date();
      facturasRepo.listarPendientesOVencidas.mockResolvedValue([
        { id: 'f1', fechaVencimiento: new Date(hoy.getTime() + 3 * MS_POR_DIA) },
        { id: 'f2', fechaVencimiento: new Date(hoy.getTime() - 5 * MS_POR_DIA) },
      ] as never);
      reglasNotificacionRepo.listarActivas.mockResolvedValue([
        { id: 'r1', offsetDias: -3, canal: 'EMAIL' },
        { id: 'r2', offsetDias: 5, canal: 'WEBHOOK' },
      ] as never);

      const total = await cron.enviarNotificacionesVencimiento();

      expect(total).toBe(2);
      expect(facturasService.notificarPorRegla).toHaveBeenCalledWith('f1', -3, 'EMAIL');
      expect(facturasService.notificarPorRegla).toHaveBeenCalledWith('f2', 5, 'WEBHOOK');
    });
  });
});
