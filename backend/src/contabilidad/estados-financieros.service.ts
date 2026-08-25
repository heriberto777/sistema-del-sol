import { Injectable } from '@nestjs/common';
import { AsientosContablesRepository } from './asientos-contables.repository';
import { CuentasContablesRepository } from './cuentas-contables.repository';

interface SaldoCuenta {
  codigo: string;
  nombre: string;
  saldo: number;
}

@Injectable()
export class EstadosFinancierosService {
  constructor(
    private readonly asientosRepository: AsientosContablesRepository,
    private readonly cuentasRepository: CuentasContablesRepository,
  ) {}

  async balanceGeneral(fecha?: string) {
    const hasta = fecha ? new Date(fecha) : new Date();
    const lineas = await this.asientosRepository.lineasHasta(hasta);

    const saldosPorCuenta = new Map<string, SaldoCuenta & { tipo: string; naturaleza: string }>();
    for (const linea of lineas) {
      const cuenta = linea.cuentaContable;
      const actual = saldosPorCuenta.get(cuenta.id) ?? { codigo: cuenta.codigo, nombre: cuenta.nombre, saldo: 0, tipo: cuenta.tipo, naturaleza: cuenta.naturaleza };
      const movimiento = cuenta.naturaleza === 'DEUDORA' ? Number(linea.debito) - Number(linea.credito) : Number(linea.credito) - Number(linea.debito);
      actual.saldo += movimiento;
      saldosPorCuenta.set(cuenta.id, actual);
    }

    const grupos: Record<'ACTIVO' | 'PASIVO' | 'PATRIMONIO', SaldoCuenta[]> = { ACTIVO: [], PASIVO: [], PATRIMONIO: [] };
    let resultadoEjercicio = 0;
    for (const cuenta of saldosPorCuenta.values()) {
      if (cuenta.tipo in grupos) {
        grupos[cuenta.tipo as keyof typeof grupos].push({ codigo: cuenta.codigo, nombre: cuenta.nombre, saldo: cuenta.saldo });
      } else if (cuenta.tipo === 'INGRESO') {
        resultadoEjercicio += cuenta.saldo;
      } else if (cuenta.tipo === 'GASTO') {
        resultadoEjercicio -= cuenta.saldo;
      }
    }

    // Sin este renglón, el balance nunca cuadra mientras haya ventas sin
    // "cerrar" contra utilidades retenidas (CierrePeriodoService.
    // cerrarPeriodo SÍ existe, pero es manual — ver ARCHITECTURE.md):
    // toda venta del tramo todavía no cerrado aumenta el Activo, pero su
    // contrapartida vive en una cuenta de INGRESO, que por definición no
    // es Activo/Pasivo/Patrimonio. Mostrar el resultado acumulado como
    // una línea de patrimonio (como hacen los balances reales antes del
    // cierre anual) es lo que hace que Activo = Pasivo + Patrimonio
    // vuelva a cumplirse — sin importar si ya hubo cierres previos (esas
    // líneas se cancelan solas entre sí) o ninguno todavía.
    if (resultadoEjercicio !== 0) {
      grupos.PATRIMONIO.push({ codigo: '3099', nombre: 'Resultado del Ejercicio (no distribuido)', saldo: resultadoEjercicio });
    }

    for (const grupo of Object.values(grupos)) {
      grupo.sort((a, b) => a.codigo.localeCompare(b.codigo));
    }

    const totalActivo = grupos.ACTIVO.reduce((acc, c) => acc + c.saldo, 0);
    const totalPasivo = grupos.PASIVO.reduce((acc, c) => acc + c.saldo, 0);
    const totalPatrimonio = grupos.PATRIMONIO.reduce((acc, c) => acc + c.saldo, 0);

    return {
      fecha: hasta,
      activo: { cuentas: grupos.ACTIVO, total: totalActivo },
      pasivo: { cuentas: grupos.PASIVO, total: totalPasivo },
      patrimonio: { cuentas: grupos.PATRIMONIO, total: totalPatrimonio },
      // Diferencia de redondeo aparte, debería ser ~0 si todos los asientos balancearon individualmente.
      diferencia: totalActivo - (totalPasivo + totalPatrimonio),
    };
  }

  async estadoResultados(desde?: string, hasta?: string) {
    const hastaFecha = hasta ? new Date(hasta) : new Date();
    const desdeFecha = desde ? new Date(desde) : new Date(hastaFecha.getFullYear(), hastaFecha.getMonth(), 1);
    const lineas = await this.asientosRepository.lineasEnRango(desdeFecha, hastaFecha);

    const saldosPorCuenta = new Map<string, SaldoCuenta & { tipo: string }>();
    for (const linea of lineas) {
      const cuenta = linea.cuentaContable;
      const actual = saldosPorCuenta.get(cuenta.id) ?? { codigo: cuenta.codigo, nombre: cuenta.nombre, saldo: 0, tipo: cuenta.tipo };
      // INGRESO es acreedora (credito-debito); GASTO es deudora (debito-credito).
      const movimiento = cuenta.tipo === 'INGRESO' ? Number(linea.credito) - Number(linea.debito) : Number(linea.debito) - Number(linea.credito);
      actual.saldo += movimiento;
      saldosPorCuenta.set(cuenta.id, actual);
    }

    const ingresos: SaldoCuenta[] = [];
    const gastos: SaldoCuenta[] = [];
    for (const cuenta of saldosPorCuenta.values()) {
      (cuenta.tipo === 'INGRESO' ? ingresos : gastos).push({ codigo: cuenta.codigo, nombre: cuenta.nombre, saldo: cuenta.saldo });
    }
    ingresos.sort((a, b) => a.codigo.localeCompare(b.codigo));
    gastos.sort((a, b) => a.codigo.localeCompare(b.codigo));

    const totalIngresos = ingresos.reduce((acc, c) => acc + c.saldo, 0);
    const totalGastos = gastos.reduce((acc, c) => acc + c.saldo, 0);

    return {
      rango: { desde: desdeFecha, hasta: hastaFecha },
      ingresos: { cuentas: ingresos, total: totalIngresos },
      gastos: { cuentas: gastos, total: totalGastos },
      utilidadNeta: totalIngresos - totalGastos,
    };
  }

  /** Detalle cronológico de movimientos de una cuenta, con saldo acumulado — lo que ARCHITECTURE.md señalaba como "libro mayor detallado por cuenta" pendiente. */
  async libroMayor(cuentaContableId: string, desde?: string, hasta?: string) {
    const cuenta = await this.cuentasRepository.buscarPorId(cuentaContableId);
    const hastaFecha = hasta ? new Date(hasta) : new Date();
    const desdeFecha = desde ? new Date(desde) : new Date(hastaFecha.getFullYear(), hastaFecha.getMonth(), 1);

    const lineas = await this.asientosRepository.lineasPorCuenta(cuentaContableId, hastaFecha);

    const movimientoDe = (linea: { debito: unknown; credito: unknown }) =>
      cuenta.naturaleza === 'DEUDORA' ? Number(linea.debito) - Number(linea.credito) : Number(linea.credito) - Number(linea.debito);

    let saldoInicial = 0;
    const movimientos: {
      id: string;
      fecha: Date;
      asientoId: string;
      asientoNumero: number;
      concepto: string;
      debito: number;
      credito: number;
      saldoAcumulado: number;
      conciliado: boolean;
    }[] = [];
    let saldoAcumulado = 0;

    for (const linea of lineas) {
      if (linea.asiento.fecha < desdeFecha) {
        saldoInicial += movimientoDe(linea);
        continue;
      }
      saldoAcumulado = (movimientos.length === 0 ? saldoInicial : saldoAcumulado) + movimientoDe(linea);
      movimientos.push({
        id: linea.id,
        fecha: linea.asiento.fecha,
        asientoId: linea.asiento.id,
        asientoNumero: linea.asiento.numero,
        concepto: linea.asiento.concepto,
        debito: Number(linea.debito),
        credito: Number(linea.credito),
        saldoAcumulado,
        conciliado: linea.conciliado,
      });
    }

    return {
      cuenta: { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre },
      rango: { desde: desdeFecha, hasta: hastaFecha },
      saldoInicial,
      movimientos,
      saldoFinal: movimientos.length > 0 ? movimientos[movimientos.length - 1].saldoAcumulado : saldoInicial,
    };
  }

  /**
   * Conciliación bancaria manual (sin importar extractos ni auto-match):
   * reusa `libroMayor` sobre la cuenta contable vinculada a la
   * CuentaBancaria, y separa el saldo entre lo que ya se marcó
   * `conciliado` y lo que sigue pendiente — el contador concilia
   * comparando visualmente contra su estado de cuenta en papel/PDF.
   */
  async conciliacionBancaria(cuentaBancariaId: string, desde?: string, hasta?: string) {
    const cuentaBancaria = await this.cuentasRepository.buscarCuentaBancariaConContable(cuentaBancariaId);
    const libro = await this.libroMayor(cuentaBancaria.cuentaContableId, desde, hasta);

    const signo = cuentaBancaria.cuentaContable.naturaleza === 'DEUDORA' ? 1 : -1;
    const montoDe = (m: { debito: number; credito: number }) => signo * (m.debito - m.credito);
    const saldoConciliado = libro.movimientos.filter((m) => m.conciliado).reduce((acc, m) => acc + montoDe(m), 0);

    return {
      cuentaBancaria: { id: cuentaBancaria.id, banco: cuentaBancaria.banco, numeroCuenta: cuentaBancaria.numeroCuenta },
      rango: libro.rango,
      saldoSegunLibros: libro.saldoFinal,
      saldoConciliado,
      saldoPendiente: libro.saldoFinal - saldoConciliado,
      movimientos: libro.movimientos,
    };
  }

  /**
   * `LineaAsiento` no tiene tenantId propio (tabla hija) — valida
   * pertenencia resolviendo el `asiento` padre por separado vía
   * `buscarPorId` (mismo patrón de `validarPertenencia` para tablas
   * hijas sin scope automático, ver CLAUDE.md/ARCHITECTURE.md): si la
   * línea fuera de otro tenant, `buscarPorId(asientoId)` no encuentra
   * nada (tenantId auto-inyectado) y lanza 404 — sin esto, cualquiera
   * podría marcar conciliada una línea de otro tenant adivinando el id.
   */
  async marcarLineaConciliada(lineaId: string, conciliado: boolean) {
    const linea = await this.asientosRepository.buscarLineaSola(lineaId);
    await this.asientosRepository.buscarPorId(linea.asientoId);
    return this.asientosRepository.marcarLineaConciliada(lineaId, conciliado);
  }

  /**
   * Balanza de comprobación: total débito/crédito y saldo (con signo
   * según naturaleza) de CADA cuenta con movimientos en el rango — a
   * diferencia del balance general/estado de resultados, incluye TODOS
   * los tipos de cuenta a la vez, no solo Activo/Pasivo/Patrimonio o
   * Ingreso/Gasto por separado.
   */
  async balanceComprobacion(desde?: string, hasta?: string) {
    const hastaFecha = hasta ? new Date(hasta) : new Date();
    const desdeFecha = desde ? new Date(desde) : new Date(0);
    const lineas = await this.asientosRepository.lineasEnRangoTodas(desdeFecha, hastaFecha);

    const porCuenta = new Map<string, { codigo: string; nombre: string; naturaleza: string; totalDebito: number; totalCredito: number }>();
    for (const linea of lineas) {
      const cuenta = linea.cuentaContable;
      const actual = porCuenta.get(cuenta.id) ?? { codigo: cuenta.codigo, nombre: cuenta.nombre, naturaleza: cuenta.naturaleza, totalDebito: 0, totalCredito: 0 };
      actual.totalDebito += Number(linea.debito);
      actual.totalCredito += Number(linea.credito);
      porCuenta.set(cuenta.id, actual);
    }

    const cuentas = Array.from(porCuenta.values())
      .map((c) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        totalDebito: c.totalDebito,
        totalCredito: c.totalCredito,
        saldo: c.naturaleza === 'DEUDORA' ? c.totalDebito - c.totalCredito : c.totalCredito - c.totalDebito,
      }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    return {
      rango: { desde: desdeFecha, hasta: hastaFecha },
      cuentas,
      totales: {
        debito: cuentas.reduce((acc, c) => acc + c.totalDebito, 0),
        credito: cuentas.reduce((acc, c) => acc + c.totalCredito, 0),
      },
    };
  }
}
