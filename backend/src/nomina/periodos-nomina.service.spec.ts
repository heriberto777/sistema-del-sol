import { BadRequestException } from '@nestjs/common';
import { PeriodosNominaService } from './periodos-nomina.service';
import { PeriodosNominaRepository } from './periodos-nomina.repository';
import { EmpleadosRepository } from './empleados.repository';
import { AusenciasRepository } from './ausencias.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

describe('PeriodosNominaService', () => {
  let service: PeriodosNominaService;
  let periodosRepository: jest.Mocked<PeriodosNominaRepository>;
  let empleadosRepository: jest.Mocked<EmpleadosRepository>;
  let ausenciasRepository: jest.Mocked<AusenciasRepository>;
  let eventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    periodosRepository = { crear: jest.fn(), buscarPorId: jest.fn(), listar: jest.fn(), actualizarEstado: jest.fn() } as unknown as jest.Mocked<PeriodosNominaRepository>;
    empleadosRepository = { listarActivos: jest.fn() } as unknown as jest.Mocked<EmpleadosRepository>;
    ausenciasRepository = { listarSinGoceSolapadas: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<AusenciasRepository>;
    eventBus = { emit: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new PeriodosNominaService(periodosRepository, empleadosRepository, ausenciasRepository, eventBus);
  });

  describe('listar', () => {
    it('pagina y pasa el filtro de estado al repositorio', async () => {
      periodosRepository.listar.mockResolvedValue([[{ id: 'p1' }], 1] as never);

      const resultado = await service.listar({ pagina: 2, tamanoPagina: 10, estado: 'PAGADO' });

      expect(periodosRepository.listar).toHaveBeenCalledWith({ skip: 10, take: 10, estado: 'PAGADO' });
      expect(resultado).toEqual({ datos: [{ id: 'p1' }], total: 1, pagina: 2, tamanoPagina: 10 });
    });
  });

  describe('generarPeriodo', () => {
    it('rechaza generar si no hay empleados activos', async () => {
      empleadosRepository.listarActivos.mockResolvedValue([]);

      await expect(service.generarPeriodo({ tipo: 'MENSUAL', fechaInicio: '2026-01-01', fechaFin: '2026-01-31' }, 't1')).rejects.toThrow(
        BadRequestException,
      );
      expect(periodosRepository.crear).not.toHaveBeenCalled();
    });

    it('MENSUAL usa factor 1 (recibo = salario completo)', async () => {
      empleadosRepository.listarActivos.mockResolvedValue([{ id: 'e1', salarioBrutoMensual: 35000 }] as never);
      periodosRepository.crear.mockResolvedValue({ id: 'p1' } as never);

      await service.generarPeriodo({ tipo: 'MENSUAL', fechaInicio: '2026-01-01', fechaFin: '2026-01-31' }, 't1');

      const [llamada] = periodosRepository.crear.mock.calls[0];
      expect(llamada.recibos[0].salarioBruto).toBe(35000);
    });

    it('QUINCENAL usa factor 0.5 (recibo = mitad del salario)', async () => {
      empleadosRepository.listarActivos.mockResolvedValue([{ id: 'e1', salarioBrutoMensual: 35000 }] as never);
      periodosRepository.crear.mockResolvedValue({ id: 'p1' } as never);

      await service.generarPeriodo({ tipo: 'QUINCENAL', fechaInicio: '2026-01-01', fechaFin: '2026-01-15' }, 't1');

      const [llamada] = periodosRepository.crear.mock.calls[0];
      expect(llamada.recibos[0].salarioBruto).toBe(17500);
    });

    it('descuenta salario por ausencias APROBADAS sin goce que se solapan con el período, sin tocar TSS/ISR', async () => {
      empleadosRepository.listarActivos.mockResolvedValue([{ id: 'e1', salarioBrutoMensual: 23830 }] as never);
      periodosRepository.crear.mockResolvedValue({ id: 'p1' } as never);
      // 3 días (lun-mié) dentro del período, ninguno domingo -> 3 * (23830/23.83) = 3000
      ausenciasRepository.listarSinGoceSolapadas.mockResolvedValue([
        { fechaDesde: new Date('2026-01-05T00:00:00.000Z'), fechaHasta: new Date('2026-01-07T00:00:00.000Z') },
      ] as never);

      await service.generarPeriodo({ tipo: 'MENSUAL', fechaInicio: '2026-01-01', fechaFin: '2026-01-31' }, 't1');

      expect(ausenciasRepository.listarSinGoceSolapadas).toHaveBeenCalledWith('e1', new Date('2026-01-01'), new Date('2026-01-31'));
      const [llamada] = periodosRepository.crear.mock.calls[0];
      expect(llamada.recibos[0].descuentoAusencias).toBeCloseTo(3000, 5);
      expect(llamada.recibos[0].sfsEmpleado).toBeCloseTo(23830 * 0.0304, 2);
    });

    it('recorta una ausencia que empieza antes del período a los límites reales del período', async () => {
      empleadosRepository.listarActivos.mockResolvedValue([{ id: 'e1', salarioBrutoMensual: 23830 }] as never);
      periodosRepository.crear.mockResolvedValue({ id: 'p1' } as never);
      // La ausencia empieza el 2025-12-29 pero el período arranca el 2026-01-01 -> solo cuentan 1 y 2 de enero (2 días).
      ausenciasRepository.listarSinGoceSolapadas.mockResolvedValue([
        { fechaDesde: new Date('2025-12-29T00:00:00.000Z'), fechaHasta: new Date('2026-01-02T00:00:00.000Z') },
      ] as never);

      await service.generarPeriodo({ tipo: 'MENSUAL', fechaInicio: '2026-01-01', fechaFin: '2026-01-31' }, 't1');

      const [llamada] = periodosRepository.crear.mock.calls[0];
      expect(llamada.recibos[0].descuentoAusencias).toBeCloseTo(2 * (23830 / 23.83), 5);
    });
  });

  describe('procesar', () => {
    it('BORRADOR -> PROCESADO', async () => {
      periodosRepository.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'BORRADOR' } as never);
      periodosRepository.actualizarEstado.mockResolvedValue({ id: 'p1', estado: 'PROCESADO' } as never);

      await service.procesar('p1');

      expect(periodosRepository.actualizarEstado).toHaveBeenCalledWith('p1', 'PROCESADO');
    });

    it('rechaza procesar un período que no está en BORRADOR', async () => {
      periodosRepository.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PAGADO' } as never);

      await expect(service.procesar('p1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('marcarPagado', () => {
    it('PROCESADO -> PAGADO y emite el evento con los totales sumados de todos los recibos', async () => {
      periodosRepository.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PROCESADO' } as never);
      periodosRepository.actualizarEstado.mockResolvedValue({
        id: 'p1',
        tenantId: 't1',
        estado: 'PAGADO',
        recibos: [
          { salarioBruto: 35000, sfsEmpleado: 1064, afpEmpleado: 1004.5, isr: 0, otrasDeducciones: 0, descuentoAusencias: 1200, salarioNeto: 31731.5, sfsEmpleador: 2481.5, afpEmpleador: 2485, infotep: 350 },
          { salarioBruto: 20000, sfsEmpleado: 608, afpEmpleado: 574, isr: 0, otrasDeducciones: 0, descuentoAusencias: 0, salarioNeto: 18818, sfsEmpleador: 1418, afpEmpleador: 1420, infotep: 200 },
        ],
      } as never);

      await service.marcarPagado('p1');

      expect(periodosRepository.actualizarEstado).toHaveBeenCalledWith('p1', 'PAGADO', expect.any(Date));
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTOS.NOMINA_PERIODO_PAGADO,
        expect.objectContaining({
          tenantId: 't1',
          periodoId: 'p1',
          totalSalarioBruto: '55000',
          totalDescuentoAusencias: '1200',
          totalSalarioNeto: '50549.5',
        }),
      );
    });

    it('rechaza marcar como pagado un período que no está PROCESADO', async () => {
      periodosRepository.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'BORRADOR' } as never);

      await expect(service.marcarPagado('p1')).rejects.toThrow(BadRequestException);
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('reporteAportes', () => {
    it('suma SFS/AFP (empleado + empleador), INFOTEP e ISR por empleado y en los totales', async () => {
      periodosRepository.buscarPorId.mockResolvedValue({
        id: 'p1',
        fechaInicio: new Date('2026-01-01'),
        fechaFin: new Date('2026-01-31'),
        recibos: [
          {
            empleadoId: 'e1',
            empleado: { cedula: '001-1', nombre: 'Ana Pérez' },
            salarioBruto: 35000,
            sfsEmpleado: 1064,
            sfsEmpleador: 2481.5,
            afpEmpleado: 1004.5,
            afpEmpleador: 2485,
            infotep: 350,
            isr: 500,
          },
          {
            empleadoId: 'e2',
            empleado: { cedula: '002-2', nombre: 'Beto Ruiz' },
            salarioBruto: 20000,
            sfsEmpleado: 608,
            sfsEmpleador: 1418,
            afpEmpleado: 574,
            afpEmpleador: 1420,
            infotep: 200,
            isr: 0,
          },
        ],
      } as never);

      const resultado = await service.reporteAportes('p1');

      expect(resultado.empleados).toHaveLength(2);
      expect(resultado.empleados[0]).toEqual(
        expect.objectContaining({ cedula: '001-1', nombre: 'Ana Pérez', salarioBruto: 35000, isr: 500 }),
      );
      expect(resultado.totales).toEqual({
        salarioBruto: 55000,
        sfsEmpleado: 1672,
        sfsEmpleador: 3899.5,
        totalSfs: 5571.5,
        afpEmpleado: 1578.5,
        afpEmpleador: 3905,
        totalAfp: 5483.5,
        infotep: 550,
        isr: 500,
      });
    });
  });
});
