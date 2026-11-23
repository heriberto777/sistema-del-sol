import { BadRequestException } from '@nestjs/common';
import { DepositosBancariosService } from './depositos-bancarios.service';
import { DepositosBancariosRepository } from './depositos-bancarios.repository';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';
import { BancosService } from '../bancos/bancos.service';
import { CuentasContablesService } from '../contabilidad/cuentas-contables.service';
import { EstadosFinancierosService } from '../contabilidad/estados-financieros.service';
import { CierrePeriodoService } from '../contabilidad/cierre-periodo.service';
import { EventBusService } from '../event-bus/event-bus.service';

describe('DepositosBancariosService (docs/PLAN.md — Depósito bancario Caja → Banco)', () => {
  let service: DepositosBancariosService;
  let repository: jest.Mocked<DepositosBancariosRepository>;
  let correlativosRepository: jest.Mocked<CorrelativosRepository>;
  let bancosService: jest.Mocked<BancosService>;
  let cuentasContablesService: jest.Mocked<CuentasContablesService>;
  let estadosFinancierosService: jest.Mocked<EstadosFinancierosService>;
  let cierrePeriodoService: jest.Mocked<CierrePeriodoService>;
  let eventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      marcarAnulado: jest.fn(),
    } as unknown as jest.Mocked<DepositosBancariosRepository>;
    correlativosRepository = { siguiente: jest.fn().mockResolvedValue('00001') } as unknown as jest.Mocked<CorrelativosRepository>;
    bancosService = { buscarPorId: jest.fn() } as unknown as jest.Mocked<BancosService>;
    cuentasContablesService = { resolverCuentaCaja: jest.fn().mockResolvedValue({ id: 'cuenta-caja-1' }) } as unknown as jest.Mocked<CuentasContablesService>;
    estadosFinancierosService = { libroMayor: jest.fn() } as unknown as jest.Mocked<EstadosFinancierosService>;
    cierrePeriodoService = { validarPeriodoAbierto: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<CierrePeriodoService>;
    eventBus = { emit: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new DepositosBancariosService(
      repository,
      correlativosRepository,
      bancosService,
      cuentasContablesService,
      estadosFinancierosService,
      cierrePeriodoService,
      eventBus,
    );
  });

  describe('crear', () => {
    it('con saldo suficiente, guarda excedioSaldo=false y emite DEPOSITO_BANCARIO_CREADO con la cuenta contable real del banco', async () => {
      bancosService.buscarPorId.mockResolvedValue({ id: 'banco-1', cuentaContableId: 'cuenta-banco-1' } as never);
      estadosFinancierosService.libroMayor.mockResolvedValue({ saldoFinal: 1000 } as never);
      repository.crear.mockResolvedValue({ id: 'dep1' } as never);

      await service.crear({ cuentaBancariaId: 'banco-1', monto: 500 }, 't1', 'user1');

      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ excedioSaldo: false, saldoDisponibleAlMomento: 1000, monto: 500 }));
      expect(eventBus.emit).toHaveBeenCalledWith('depositos_bancarios.creado', {
        tenantId: 't1',
        depositoId: 'dep1',
        cuentaBancariaCuentaContableId: 'cuenta-banco-1',
        monto: '500',
      });
    });

    it('con un monto mayor al saldo disponible, guarda excedioSaldo=true pero igual lo crea (solo advierte, no bloquea)', async () => {
      bancosService.buscarPorId.mockResolvedValue({ id: 'banco-1', cuentaContableId: 'cuenta-banco-1' } as never);
      estadosFinancierosService.libroMayor.mockResolvedValue({ saldoFinal: 200 } as never);
      repository.crear.mockResolvedValue({ id: 'dep1' } as never);

      await service.crear({ cuentaBancariaId: 'banco-1', monto: 500 }, 't1', 'user1');

      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ excedioSaldo: true, saldoDisponibleAlMomento: 200 }));
    });
  });

  describe('editar', () => {
    it('rechaza editar un depósito ya ANULADO', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'ANULADO' } as never);

      await expect(service.editar('dep1', { cuentaBancariaId: 'banco-1', monto: 100 }, 't1')).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });

    it('calcula el saldo SIN el efecto del depósito viejo (se lo devuelve, era un crédito a Caja) antes de decidir excedioSaldo', async () => {
      repository.buscarPorId.mockResolvedValue({
        estado: 'ABIERTO',
        fecha: new Date('2026-11-01'),
        monto: 500,
        cuentaBancaria: { cuentaContableId: 'cuenta-banco-viejo' },
      } as never);
      bancosService.buscarPorId.mockResolvedValue({ id: 'banco-2', cuentaContableId: 'cuenta-banco-nuevo' } as never);
      // Saldo actual YA refleja el crédito del depósito viejo (500 restados) — sin él sería 1000.
      estadosFinancierosService.libroMayor.mockResolvedValue({ saldoFinal: 500 } as never);
      repository.actualizar.mockResolvedValue({ id: 'dep1' } as never);

      await service.editar('dep1', { cuentaBancariaId: 'banco-2', monto: 700 }, 't1');

      expect(repository.actualizar).toHaveBeenCalledWith(
        'dep1',
        expect.objectContaining({ saldoDisponibleAlMomento: 1000, excedioSaldo: false, monto: 700, cuentaBancariaId: 'banco-2' }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith('depositos_bancarios.editado', {
        tenantId: 't1',
        depositoId: 'dep1',
        cuentaBancariaCuentaContableIdAnterior: 'cuenta-banco-viejo',
        montoAnterior: '500',
        cuentaBancariaCuentaContableIdNuevo: 'cuenta-banco-nuevo',
        montoNuevo: '700',
      });
    });
  });

  describe('anular', () => {
    it('rechaza anular un depósito ya anulado', async () => {
      repository.buscarPorId.mockResolvedValue({ estado: 'ANULADO' } as never);

      await expect(service.anular('dep1', 't1')).rejects.toThrow(BadRequestException);
      expect(repository.marcarAnulado).not.toHaveBeenCalled();
    });

    it('marca ANULADO y emite DEPOSITO_BANCARIO_ANULADO con los valores vigentes', async () => {
      repository.buscarPorId.mockResolvedValue({
        estado: 'ABIERTO',
        fecha: new Date('2026-11-01'),
        monto: 500,
        cuentaBancaria: { cuentaContableId: 'cuenta-banco-1' },
      } as never);
      repository.marcarAnulado.mockResolvedValue({ id: 'dep1', estado: 'ANULADO' } as never);

      await service.anular('dep1', 't1');

      expect(repository.marcarAnulado).toHaveBeenCalledWith('dep1');
      expect(eventBus.emit).toHaveBeenCalledWith('depositos_bancarios.anulado', {
        tenantId: 't1',
        depositoId: 'dep1',
        cuentaBancariaCuentaContableId: 'cuenta-banco-1',
        monto: '500',
      });
    });
  });
});
