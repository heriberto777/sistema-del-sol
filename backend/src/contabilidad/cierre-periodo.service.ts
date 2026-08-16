import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CierrePeriodoRepository } from './cierre-periodo.repository';
import { AsientosContablesRepository } from './asientos-contables.repository';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { CODIGOS_CUENTA } from './cuentas-base';
import { CerrarPeriodoDto } from './dto/cerrar-periodo.dto';

const EPSILON = 0.005;

/** Los movimientos del propio día de corte deben quedar incluidos en el cierre — sin esto, un `fecha` de solo-día (medianoche) excluiría todo lo ocurrido ese mismo día. */
function finDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

interface LineaCierre {
  cuentaContableId: string;
  debito: number;
  credito: number;
  descripcion: string;
}

@Injectable()
export class CierrePeriodoService {
  private readonly logger = new Logger(CierrePeriodoService.name);

  constructor(
    private readonly cierreRepository: CierrePeriodoRepository,
    private readonly asientosRepository: AsientosContablesRepository,
    private readonly cuentasRepository: CuentasContablesRepository,
  ) {}

  listar() {
    return this.cierreRepository.listar();
  }

  /**
   * Traspasa el saldo neto de las cuentas de INGRESO/GASTO acumulado desde
   * el último cierre (o desde el inicio, si es el primero) hasta `fecha`,
   * a Utilidades Retenidas — el "cierre de período" que estados-financieros.service.ts
   * señala como no implementado. Alcance deliberado (ver ARCHITECTURE.md):
   * solo cierra INGRESO/GASTO contra patrimonio; no bloquea retroactivamente
   * los asientos AUTOMÁTICOS (factura/compra/nómina/pago), que siempre se
   * fechan a "ahora" y por lo tanto nunca caen dentro de un período ya
   * cerrado en la práctica — solo los asientos MANUALES y los "gastos
   * rápidos" (fecha elegida a mano) se validan contra el último cierre, en
   * AsientosContablesService.
   */
  async cerrarPeriodo(dto: CerrarPeriodoDto, tenantId: string) {
    const fecha = new Date(dto.fecha);
    const ultimo = await this.cierreRepository.buscarUltimo();
    if (ultimo && fecha <= ultimo.fecha) {
      throw new BadRequestException(
        `Ya existe un cierre en o después de esta fecha (último cierre: ${ultimo.fecha.toISOString().slice(0, 10)})`,
      );
    }

    const desde = ultimo ? new Date(ultimo.fecha.getTime() + 1) : new Date(0);
    const lineas = await this.asientosRepository.lineasEnRango(desde, finDelDia(fecha));
    if (lineas.length === 0) {
      throw new BadRequestException('No hay movimientos de ingresos/gastos en el período a cerrar');
    }

    const saldosPorCuenta = new Map<string, { id: string; codigo: string; nombre: string; tipo: string; saldo: number }>();
    for (const linea of lineas) {
      const cuenta = linea.cuentaContable;
      const actual = saldosPorCuenta.get(cuenta.id) ?? { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre, tipo: cuenta.tipo, saldo: 0 };
      const movimiento = cuenta.tipo === 'INGRESO' ? Number(linea.credito) - Number(linea.debito) : Number(linea.debito) - Number(linea.credito);
      actual.saldo += movimiento;
      saldosPorCuenta.set(cuenta.id, actual);
    }

    const lineasCierre: LineaCierre[] = [];
    let utilidadNeta = 0;
    for (const cuenta of saldosPorCuenta.values()) {
      if (Math.abs(cuenta.saldo) < EPSILON) continue;
      if (cuenta.tipo === 'INGRESO') {
        utilidadNeta += cuenta.saldo;
        lineasCierre.push({
          cuentaContableId: cuenta.id,
          debito: cuenta.saldo > 0 ? cuenta.saldo : 0,
          credito: cuenta.saldo < 0 ? -cuenta.saldo : 0,
          descripcion: `Cierre — ${cuenta.nombre}`,
        });
      } else {
        utilidadNeta -= cuenta.saldo;
        lineasCierre.push({
          cuentaContableId: cuenta.id,
          credito: cuenta.saldo > 0 ? cuenta.saldo : 0,
          debito: cuenta.saldo < 0 ? -cuenta.saldo : 0,
          descripcion: `Cierre — ${cuenta.nombre}`,
        });
      }
    }

    const cuentaUtilidades = await this.cuentasRepository.buscarPorCodigo(CODIGOS_CUENTA.UTILIDADES_RETENIDAS);
    lineasCierre.push(
      utilidadNeta >= 0
        ? { cuentaContableId: cuentaUtilidades.id, debito: 0, credito: utilidadNeta, descripcion: 'Cierre — utilidad del período' }
        : { cuentaContableId: cuentaUtilidades.id, debito: -utilidadNeta, credito: 0, descripcion: 'Cierre — pérdida del período' },
    );

    this.validarBalance(lineasCierre);

    const asiento = await this.asientosRepository.crear({
      tenantId,
      concepto: `Cierre del período al ${dto.fecha.slice(0, 10)}`,
      origen: 'CIERRE',
      fecha,
      lineas: lineasCierre,
    });

    return this.cierreRepository.crear({ tenantId, fecha, utilidadNeta, asientoCierreId: asiento.id });
  }

  private validarBalance(lineas: { debito: number; credito: number }[]) {
    const totalDebito = lineas.reduce((acc, l) => acc + l.debito, 0);
    const totalCredito = lineas.reduce((acc, l) => acc + l.credito, 0);
    if (Math.abs(totalDebito - totalCredito) > EPSILON) {
      this.logger.error(`Asiento de cierre desbalanceado: débito=${totalDebito} crédito=${totalCredito}`);
      throw new BadRequestException('El asiento de cierre no balancea — no debería ocurrir, revisar los saldos de las cuentas involucradas');
    }
  }
}
