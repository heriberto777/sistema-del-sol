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
    // "cerrar" contra utilidades retenidas (proceso de cierre de periodo
    // que este sistema no implementa todavía — ver ARCHITECTURE.md): toda
    // venta aumenta el Activo, pero su contrapartida vive en una cuenta de
    // INGRESO, que por definición no es Activo/Pasivo/Patrimonio. Mostrar
    // el resultado acumulado como una línea de patrimonio (como hacen los
    // balances reales antes del cierre anual) es lo que hace que
    // Activo = Pasivo + Patrimonio vuelva a cumplirse.
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
    const movimientos: { fecha: Date; asientoId: string; asientoNumero: number; concepto: string; debito: number; credito: number; saldoAcumulado: number }[] = [];
    let saldoAcumulado = 0;

    for (const linea of lineas) {
      if (linea.asiento.fecha < desdeFecha) {
        saldoInicial += movimientoDe(linea);
        continue;
      }
      saldoAcumulado = (movimientos.length === 0 ? saldoInicial : saldoAcumulado) + movimientoDe(linea);
      movimientos.push({
        fecha: linea.asiento.fecha,
        asientoId: linea.asiento.id,
        asientoNumero: linea.asiento.numero,
        concepto: linea.asiento.concepto,
        debito: Number(linea.debito),
        credito: Number(linea.credito),
        saldoAcumulado,
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
}
