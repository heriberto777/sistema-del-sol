import { EstadosFinancierosService } from './estados-financieros.service';
import { AsientosContablesRepository } from './asientos-contables.repository';
import { CuentasContablesRepository } from './cuentas-contables.repository';

describe('EstadosFinancierosService', () => {
  let service: EstadosFinancierosService;
  let repository: jest.Mocked<AsientosContablesRepository>;
  let cuentasRepository: jest.Mocked<CuentasContablesRepository>;

  beforeEach(() => {
    repository = {
      lineasHasta: jest.fn(),
      lineasEnRango: jest.fn(),
      lineasEnRangoTodas: jest.fn(),
      lineasPorCuenta: jest.fn(),
      buscarLineaSola: jest.fn(),
      buscarPorId: jest.fn(),
      marcarLineaConciliada: jest.fn(),
    } as unknown as jest.Mocked<AsientosContablesRepository>;
    cuentasRepository = { buscarPorId: jest.fn(), buscarCuentaBancariaConContable: jest.fn() } as unknown as jest.Mocked<CuentasContablesRepository>;
    service = new EstadosFinancierosService(repository, cuentasRepository);
  });

  function linea(cuenta: { id: string; codigo: string; nombre: string; tipo: string; naturaleza: string }, debito: number, credito: number) {
    return { debito, credito, cuentaContable: cuenta };
  }

  describe('balanceGeneral', () => {
    it('una cuenta deudora (ACTIVO) suma débito y resta crédito', async () => {
      const caja = { id: 'c1', codigo: '1010', nombre: 'Caja', tipo: 'ACTIVO', naturaleza: 'DEUDORA' };
      repository.lineasHasta.mockResolvedValue([linea(caja, 354, 0), linea(caja, 0, 100)] as never);

      const { activo } = await service.balanceGeneral();

      expect(activo.cuentas).toEqual([{ codigo: '1010', nombre: 'Caja', saldo: 254 }]);
      expect(activo.total).toBe(254);
    });

    it('una cuenta acreedora (PASIVO) suma crédito y resta débito', async () => {
      const itbisPorPagar = { id: 'c2', codigo: '2020', nombre: 'ITBIS por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' };
      repository.lineasHasta.mockResolvedValue([linea(itbisPorPagar, 0, 54)] as never);

      const { pasivo } = await service.balanceGeneral();

      expect(pasivo.total).toBe(54);
    });

    it('activo = pasivo + patrimonio cuando los asientos balancean (diferencia ~0)', async () => {
      const caja = { id: 'c1', codigo: '1010', nombre: 'Caja', tipo: 'ACTIVO', naturaleza: 'DEUDORA' };
      const ingresos = { id: 'c2', codigo: '4010', nombre: 'Ingresos', tipo: 'INGRESO', naturaleza: 'ACREEDORA' };
      const itbis = { id: 'c3', codigo: '2020', nombre: 'ITBIS por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' };
      // El ingreso (INGRESO) no es activo/pasivo/patrimonio por sí mismo, pero su saldo
      // se refleja como "Resultado del Ejercicio" dentro de patrimonio — así el balance
      // vuelve a cuadrar sin necesitar un cierre de período.
      repository.lineasHasta.mockResolvedValue([linea(caja, 354, 0), linea(ingresos, 0, 300), linea(itbis, 0, 54)] as never);

      const resultado = await service.balanceGeneral();

      expect(resultado.patrimonio.cuentas).toEqual([{ codigo: '3099', nombre: 'Resultado del Ejercicio (no distribuido)', saldo: 300 }]);
      expect(resultado.diferencia).toBe(0);
    });

    it('una cuenta de GASTO reduce el resultado del ejercicio (patrimonio negativo)', async () => {
      const gasto = { id: 'g1', codigo: '5020', nombre: 'Gastos Operativos', tipo: 'GASTO', naturaleza: 'DEUDORA' };
      repository.lineasHasta.mockResolvedValue([linea(gasto, 100, 0)] as never);

      const resultado = await service.balanceGeneral();

      expect(resultado.activo.cuentas).toEqual([]);
      expect(resultado.pasivo.cuentas).toEqual([]);
      expect(resultado.patrimonio.cuentas).toEqual([{ codigo: '3099', nombre: 'Resultado del Ejercicio (no distribuido)', saldo: -100 }]);
    });

    it('no agrega la línea de resultado del ejercicio cuando ingresos y gastos están vacíos', async () => {
      const caja = { id: 'c1', codigo: '1010', nombre: 'Caja', tipo: 'ACTIVO', naturaleza: 'DEUDORA' };
      repository.lineasHasta.mockResolvedValue([linea(caja, 100, 0)] as never);

      const resultado = await service.balanceGeneral();

      expect(resultado.patrimonio.cuentas).toEqual([]);
    });
  });

  describe('estadoResultados', () => {
    it('utilidadNeta = total ingresos - total gastos', async () => {
      const ingresos = { id: 'c1', codigo: '4010', nombre: 'Ingresos por Ventas', tipo: 'INGRESO', naturaleza: 'ACREEDORA' };
      const costo = { id: 'c2', codigo: '5010', nombre: 'Costo de Ventas', tipo: 'GASTO', naturaleza: 'DEUDORA' };
      repository.lineasEnRango.mockResolvedValue([linea(ingresos, 0, 1000), linea(costo, 400, 0)] as never);

      const resultado = await service.estadoResultados();

      expect(resultado.ingresos.total).toBe(1000);
      expect(resultado.gastos.total).toBe(400);
      expect(resultado.utilidadNeta).toBe(600);
    });

    it('usa el mes actual como rango por defecto', async () => {
      repository.lineasEnRango.mockResolvedValue([]);

      const { rango } = await service.estadoResultados();

      expect(rango.desde.getDate()).toBe(1);
    });
  });

  describe('libroMayor', () => {
    const caja = { id: 'c1', codigo: '1010', nombre: 'Caja', naturaleza: 'DEUDORA' };

    function lineaAsiento(debito: number, credito: number, fecha: string, numero: number, concepto = 'Movimiento') {
      return { debito, credito, asiento: { id: `a-${numero}`, numero, fecha: new Date(fecha), concepto } };
    }

    it('acumula el saldo cronológicamente y arrastra el saldo inicial de antes del rango', async () => {
      cuentasRepository.buscarPorId.mockResolvedValue(caja as never);
      repository.lineasPorCuenta.mockResolvedValue([
        lineaAsiento(500, 0, '2026-06-15', 1, 'Saldo previo'),
        lineaAsiento(300, 0, '2026-07-05', 2, 'Venta'),
        lineaAsiento(0, 100, '2026-07-10', 3, 'Gasto'),
      ] as never);

      const resultado = await service.libroMayor('c1', '2026-07-01', '2026-07-31');

      expect(resultado.saldoInicial).toBe(500);
      expect(resultado.movimientos).toEqual([
        expect.objectContaining({ concepto: 'Venta', saldoAcumulado: 800 }),
        expect.objectContaining({ concepto: 'Gasto', saldoAcumulado: 700 }),
      ]);
      expect(resultado.saldoFinal).toBe(700);
    });

    it('para una cuenta acreedora, el crédito aumenta el saldo', async () => {
      const itbisPorPagar = { id: 'c2', codigo: '2020', nombre: 'ITBIS por Pagar', naturaleza: 'ACREEDORA' };
      cuentasRepository.buscarPorId.mockResolvedValue(itbisPorPagar as never);
      repository.lineasPorCuenta.mockResolvedValue([lineaAsiento(0, 54, '2026-07-05', 1)] as never);

      const resultado = await service.libroMayor('c2', '2026-07-01', '2026-07-31');

      expect(resultado.movimientos[0].saldoAcumulado).toBe(54);
    });

    it('sin movimientos en el rango, saldoFinal es igual al saldoInicial', async () => {
      cuentasRepository.buscarPorId.mockResolvedValue(caja as never);
      repository.lineasPorCuenta.mockResolvedValue([lineaAsiento(200, 0, '2026-06-01', 1)] as never);

      const resultado = await service.libroMayor('c1', '2026-07-01', '2026-07-31');

      expect(resultado.movimientos).toEqual([]);
      expect(resultado.saldoInicial).toBe(200);
      expect(resultado.saldoFinal).toBe(200);
    });
  });

  describe('conciliacionBancaria', () => {
    const caja = { id: 'c1', codigo: '1010', nombre: 'Caja y Bancos', naturaleza: 'DEUDORA' };
    const cuentaBancaria = { id: 'banco-1', banco: 'Banco Popular', numeroCuenta: '123', cuentaContableId: 'c1', cuentaContable: caja };

    function lineaAsiento(debito: number, credito: number, fecha: string, numero: number, conciliado = false) {
      return { id: `l-${numero}`, debito, credito, conciliado, asiento: { id: `a-${numero}`, numero, fecha: new Date(fecha), concepto: 'Movimiento' } };
    }

    it('separa el saldo conciliado del pendiente según la naturaleza de la cuenta', async () => {
      cuentasRepository.buscarCuentaBancariaConContable.mockResolvedValue(cuentaBancaria as never);
      cuentasRepository.buscarPorId.mockResolvedValue(caja as never);
      repository.lineasPorCuenta.mockResolvedValue([
        lineaAsiento(1000, 0, '2026-08-05', 1, true), // conciliado: +1000
        lineaAsiento(0, 300, '2026-08-10', 2, false), // pendiente: -300
      ] as never);

      const resultado = await service.conciliacionBancaria('banco-1', '2026-08-01', '2026-08-31');

      expect(resultado.saldoSegunLibros).toBe(700);
      expect(resultado.saldoConciliado).toBe(1000);
      expect(resultado.saldoPendiente).toBe(-300);
      expect(resultado.cuentaBancaria).toEqual({ id: 'banco-1', banco: 'Banco Popular', numeroCuenta: '123' });
    });
  });

  describe('marcarLineaConciliada', () => {
    it('rechaza (propaga el error) si el asiento padre no pertenece al tenant actual', async () => {
      repository.buscarLineaSola.mockResolvedValue({ id: 'l1', asientoId: 'a1' } as never);
      repository.buscarPorId.mockRejectedValue(new Error('P2025'));

      await expect(service.marcarLineaConciliada('l1', true)).rejects.toThrow();
      expect(repository.marcarLineaConciliada).not.toHaveBeenCalled();
    });

    it('marca la línea conciliada si el asiento padre se resuelve (pertenece al tenant)', async () => {
      repository.buscarLineaSola.mockResolvedValue({ id: 'l1', asientoId: 'a1' } as never);
      repository.buscarPorId.mockResolvedValue({ id: 'a1' } as never);
      repository.marcarLineaConciliada.mockResolvedValue({ id: 'l1', conciliado: true } as never);

      await service.marcarLineaConciliada('l1', true);

      expect(repository.buscarPorId).toHaveBeenCalledWith('a1');
      expect(repository.marcarLineaConciliada).toHaveBeenCalledWith('l1', true);
    });
  });

  describe('balanceComprobacion', () => {
    it('acumula débito/crédito por cuenta y calcula el saldo según naturaleza', async () => {
      const caja = { id: 'c1', codigo: '1010', nombre: 'Caja', tipo: 'ACTIVO', naturaleza: 'DEUDORA' };
      const itbis = { id: 'c2', codigo: '2020', nombre: 'ITBIS por Pagar', tipo: 'PASIVO', naturaleza: 'ACREEDORA' };
      repository.lineasEnRangoTodas.mockResolvedValue([linea(caja, 354, 0), linea(caja, 0, 100), linea(itbis, 0, 54)] as never);

      const resultado = await service.balanceComprobacion();

      expect(resultado.cuentas).toEqual([
        { codigo: '1010', nombre: 'Caja', totalDebito: 354, totalCredito: 100, saldo: 254 },
        { codigo: '2020', nombre: 'ITBIS por Pagar', totalDebito: 0, totalCredito: 54, saldo: 54 },
      ]);
      expect(resultado.totales).toEqual({ debito: 354, credito: 154 });
    });

    it('los totales de débito y crédito cuadran cuando todos los asientos balancearon', async () => {
      const caja = { id: 'c1', codigo: '1010', nombre: 'Caja', tipo: 'ACTIVO', naturaleza: 'DEUDORA' };
      const ingresos = { id: 'c2', codigo: '4010', nombre: 'Ingresos', tipo: 'INGRESO', naturaleza: 'ACREEDORA' };
      repository.lineasEnRangoTodas.mockResolvedValue([linea(caja, 118, 0), linea(ingresos, 0, 118)] as never);

      const resultado = await service.balanceComprobacion();

      expect(resultado.totales.debito).toBe(resultado.totales.credito);
    });
  });
});
