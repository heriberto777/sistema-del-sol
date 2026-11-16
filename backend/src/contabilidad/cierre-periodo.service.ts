import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CierrePeriodoRepository } from './cierre-periodo.repository';
import { AsientosContablesRepository } from './asientos-contables.repository';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { CODIGOS_CUENTA } from './cuentas-base';
import { CerrarPeriodoDto } from './dto/cerrar-periodo.dto';
import { rangoDelMesSiguiente } from './periodos-contables.util';

const EPSILON = 0.005;

interface LineaCierre {
  cuentaContableId: string;
  debito: number;
  credito: number;
  descripcion: string;
}

// timeZone: 'UTC' a propósito — fechaInicio se construye en UTC
// (rangoDelMes), mostrarla en horario local correría el mes cerca de
// medianoche.
function etiquetaPeriodo(fechaInicio: Date) {
  return fechaInicio.toLocaleDateString('es-DO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
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
   * Reemplaza a la vieja validación contra "el último cierre" — ahora
   * valida contra un PeriodoContable real (ver schema.prisma). Los 4
   * llamadores originales (Asiento manual/Gasto rápido/anulación,
   * GastosMenoresService, FacturasProveedorService, PagosService) son las
   * únicas rutas de negocio con fecha manual retroactiva, y validan contra
   * esa fecha elegida. Fase 2 sumó a Facturación (crear/anular, POS lo
   * hereda gratis al llamar a FacturacionService.crear()), Compras
   * (recibir/devolver) y Nómina (marcarPagado) — ninguno de estos admite
   * fecha manual (siempre "ahora"), así que ahí la validación solo puede
   * rechazar si se cerró por error el período que cubre hoy (ver el
   * guardarraíl correspondiente en cerrarPeriodo, más abajo).
   */
  async validarPeriodoAbierto(fecha: Date) {
    const periodo = await this.cierreRepository.buscarPorFecha(fecha);
    if (!periodo) {
      throw new BadRequestException(`No hay un período contable definido para la fecha ${fecha.toISOString().slice(0, 10)}`);
    }
    if (periodo.estado === 'CERRADO') {
      throw new BadRequestException(`El período que cubre la fecha ${fecha.toISOString().slice(0, 10)} ya está cerrado`);
    }
  }

  /**
   * Cierra el período ABIERTO más antiguo (nunca uno arbitrario — evita
   * huecos sin período, ver el comentario del modelo PeriodoContable).
   * Traspasa el saldo neto de INGRESO/GASTO de ESE rango exacto
   * (fechaInicio/fechaFin ya guardados en el período, no hace falta
   * buscar "el último cierre") a Utilidades Retenidas, con un asiento
   * automático — el "cierre de período" que estados-financieros.service.ts
   * señala como no implementado. Si el período siguiente todavía no
   * existe (se cerró antes de que el cron lo creara), lo crea en el mismo
   * paso — cerrar nunca deja un hueco que bloquee la operación del día
   * siguiente.
   *
   * Fase 2 — no se puede cerrar el período que todavía cubre "hoy" (ni uno
   * futuro): a diferencia de los 4 llamadores viejos de
   * validarPeriodoAbierto (ajustes contables con fecha retroactiva, que un
   * contador puede re-fechar al mes siguiente), Facturación/POS/Compras/
   * Nómina nunca traen fecha manual — siempre operan "ahora". Si se
   * permitiera cerrar el mes en curso a mitad de mes, esos 4 módulos
   * quedarían bloqueados de inmediato hasta el día 1 del mes siguiente, sin
   * ningún endpoint de reapertura. Por eso solo se puede cerrar un período
   * ya terminado (fechaFin < hoy).
   */
  async cerrarPeriodo(dto: CerrarPeriodoDto, tenantId: string) {
    const masAntiguo = await this.cierreRepository.buscarAbiertoMasAntiguo();
    if (!masAntiguo) {
      throw new BadRequestException('No hay ningún período abierto para cerrar.');
    }
    if (masAntiguo.id !== dto.periodoId) {
      throw new BadRequestException(`Hay que cerrar primero el período más antiguo todavía abierto (${etiquetaPeriodo(masAntiguo.fechaInicio)}).`);
    }
    if (masAntiguo.fechaFin >= new Date()) {
      throw new BadRequestException(`Todavía no termina el período ${etiquetaPeriodo(masAntiguo.fechaInicio)} — no se puede cerrar hasta que acabe.`);
    }

    const lineas = await this.asientosRepository.lineasEnRango(masAntiguo.fechaInicio, masAntiguo.fechaFin);
    if (lineas.length === 0) {
      throw new BadRequestException('No hay movimientos de ingresos/gastos en este período.');
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
      concepto: `Cierre del período ${etiquetaPeriodo(masAntiguo.fechaInicio)}`,
      origen: 'CIERRE',
      fecha: masAntiguo.fechaFin,
      lineas: lineasCierre,
    });

    const cerrado = await this.cierreRepository.cerrar(masAntiguo.id, { utilidadNeta, asientoCierreId: asiento.id });

    // A partir de fechaFin, no de fechaInicio — para el primer período de
    // un tenant con historial (backfill-periodos-contables.ts, fechaInicio
    // = epoch) "el mes después de fechaInicio" no tiene ningún sentido real;
    // "el mes después de fechaFin" sí lo tiene siempre, y en un período
    // normal (fechaInicio/fechaFin dentro del mismo mes) da exactamente lo
    // mismo.
    const siguiente = rangoDelMesSiguiente(masAntiguo.fechaFin);
    const siguienteExiste = await this.cierreRepository.buscarPorFecha(siguiente.fechaInicio);
    if (!siguienteExiste) {
      await this.cierreRepository.crear({ tenantId, ...siguiente });
      this.logger.log(`Período ${etiquetaPeriodo(siguiente.fechaInicio)} creado automáticamente al cerrar ${etiquetaPeriodo(masAntiguo.fechaInicio)}.`);
    }

    return cerrado;
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
