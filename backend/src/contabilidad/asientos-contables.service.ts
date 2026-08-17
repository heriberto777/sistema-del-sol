import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AsientosContablesRepository } from './asientos-contables.repository';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { CierrePeriodoRepository } from './cierre-periodo.repository';
import { CODIGOS_CUENTA } from './cuentas-base';
import { CrearAsientoDto } from './dto/crear-asiento.dto';
import { CrearGastoDto } from './dto/crear-gasto.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

const EPSILON = 0.005; // tolerancia de redondeo en centavos

interface LineaCalculada {
  cuentaContableId: string;
  debito: number;
  credito: number;
  descripcion?: string;
}

@Injectable()
export class AsientosContablesService {
  private readonly logger = new Logger(AsientosContablesService.name);

  constructor(
    private readonly asientosRepository: AsientosContablesRepository,
    private readonly cuentasRepository: CuentasContablesRepository,
    private readonly cierrePeriodoRepository: CierrePeriodoRepository,
  ) {}

  async crear(dto: CrearAsientoDto, tenantId: string) {
    const lineas = dto.lineas.map((l) => ({ cuentaContableId: l.cuentaContableId, debito: l.debito ?? 0, credito: l.credito ?? 0, descripcion: l.descripcion }));
    this.validarBalance(lineas);
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    await this.validarPeriodoAbierto(fecha);

    return this.asientosRepository.crear({
      tenantId,
      concepto: dto.concepto,
      origen: 'MANUAL',
      fecha,
      lineas,
    });
  }

  buscarPorId(id: string) {
    return this.asientosRepository.buscarPorId(id);
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.asientosRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  /**
   * Venta CONTADO -> Caja; CREDITO/NOTA_DEBITO -> Cuentas por Cobrar (no
   * se distingue si la nota de débito es sobre una venta contado o a
   * crédito — simplificación de v1). NOTA_CREDITO ya llega con
   * subtotal/itbis/total en negativo (ver FacturacionService), así que
   * reutilizar la misma fórmula de signo invierte automáticamente
   * débito/crédito sin necesitar una rama de código aparte.
   */
  async generarDesdeFactura(params: { tenantId: string; facturaId: string; tipoFactura: string; subtotal: number; itbis: number; total: number }) {
    const [cuentaCobro, cuentaIngresos, cuentaItbis] = await Promise.all([
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, params.tipoFactura === 'CONTADO' ? CODIGOS_CUENTA.CAJA_BANCOS : CODIGOS_CUENTA.CUENTAS_POR_COBRAR),
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.INGRESOS_POR_VENTAS),
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.ITBIS_POR_PAGAR),
    ]);

    const lineas = [
      this.lineaSegunSigno(cuentaCobro.id, params.total, 'debito', `Factura ${params.facturaId}`),
      this.lineaSegunSigno(cuentaIngresos.id, params.subtotal, 'credito', `Factura ${params.facturaId}`),
    ];
    if (params.itbis !== 0) {
      lineas.push(this.lineaSegunSigno(cuentaItbis.id, params.itbis, 'credito', `Factura ${params.facturaId}`));
    }

    return this.crearAsientoAutomatico({
      tenantId: params.tenantId,
      concepto: `Venta — factura ${params.facturaId}`,
      origen: 'FACTURA',
      origenId: params.facturaId,
      lineas,
    });
  }

  /** Reversa exacta del asiento de venta — misma fórmula, montos negados. */
  async generarReversaFactura(params: { tenantId: string; facturaId: string; tipoFactura: string; subtotal: number; itbis: number; total: number }) {
    return this.generarDesdeFactura({ ...params, subtotal: -params.subtotal, itbis: -params.itbis, total: -params.total });
  }

  /** Compra recibida -> Inventario + ITBIS adelantado, contra Cuentas por Pagar. */
  async generarDesdeCompra(params: { tenantId: string; recepcionId: string; monto: number; itbis: number }) {
    const [cuentaInventario, cuentaItbis, cuentaPorPagar] = await Promise.all([
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.INVENTARIO),
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.ITBIS_ADELANTADO),
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.CUENTAS_POR_PAGAR),
    ]);

    const total = params.monto + params.itbis;
    const lineas = [this.lineaSegunSigno(cuentaInventario.id, params.monto, 'debito', `Recepción ${params.recepcionId}`)];
    if (params.itbis !== 0) {
      lineas.push(this.lineaSegunSigno(cuentaItbis.id, params.itbis, 'debito', `Recepción ${params.recepcionId}`));
    }
    lineas.push(this.lineaSegunSigno(cuentaPorPagar.id, total, 'credito', `Recepción ${params.recepcionId}`));

    return this.crearAsientoAutomatico({
      tenantId: params.tenantId,
      concepto: `Compra recibida — recepción ${params.recepcionId}`,
      origen: 'COMPRA',
      origenId: params.recepcionId,
      lineas,
    });
  }

  /** Reversa exacta del asiento de compra — misma fórmula que `generarDesdeCompra`, montos negados (reduce Inventario/ITBIS Adelantado y lo que se le debe al proveedor). */
  async generarReversaCompra(params: { tenantId: string; devolucionId: string; monto: number; itbis: number }) {
    const [cuentaInventario, cuentaItbis, cuentaPorPagar] = await Promise.all([
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.INVENTARIO),
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.ITBIS_ADELANTADO),
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.CUENTAS_POR_PAGAR),
    ]);

    const total = params.monto + params.itbis;
    const lineas = [this.lineaSegunSigno(cuentaInventario.id, -params.monto, 'debito', `Devolución a proveedor ${params.devolucionId}`)];
    if (params.itbis !== 0) {
      lineas.push(this.lineaSegunSigno(cuentaItbis.id, -params.itbis, 'debito', `Devolución a proveedor ${params.devolucionId}`));
    }
    lineas.push(this.lineaSegunSigno(cuentaPorPagar.id, -total, 'credito', `Devolución a proveedor ${params.devolucionId}`));

    return this.crearAsientoAutomatico({
      tenantId: params.tenantId,
      concepto: `Devolución a proveedor — ${params.devolucionId}`,
      origen: 'COMPRA',
      origenId: params.devolucionId,
      lineas,
    });
  }

  /**
   * Nómina pagada -> débito Gastos de Nómina (bruto + aportes patronales:
   * el costo laboral real de la empresa), crédito Caja (neto pagado a los
   * empleados) y crédito TSS e ISR por Pagar (retenciones al empleado +
   * aportes patronales, todo lo que se le debe a TSS/DGII y aún no se ha
   * remitido). Simplificación de v1: `otrasDeducciones` (descuentos no
   * fiscales, p. ej. un préstamo interno) se agrupa también en TSS e ISR
   * por Pagar en vez de tener su propia sub-cuenta — si el negocio
   * necesita rastrear eso por separado, es la extensión natural.
   */
  async generarDesdeNomina(params: {
    tenantId: string;
    periodoId: string;
    totalSalarioBruto: number;
    totalSfsEmpleado: number;
    totalAfpEmpleado: number;
    totalIsr: number;
    totalOtrasDeducciones: number;
    totalSalarioNeto: number;
    totalSfsEmpleador: number;
    totalAfpEmpleador: number;
    totalInfotep: number;
  }) {
    const [cuentaGastoNomina, cuentaCaja, cuentaTssIsr] = await Promise.all([
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.GASTOS_DE_NOMINA),
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.CAJA_BANCOS),
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.TSS_ISR_POR_PAGAR),
    ]);

    const costoLaboral = params.totalSalarioBruto + params.totalSfsEmpleador + params.totalAfpEmpleador + params.totalInfotep;
    const porPagarTssIsr =
      params.totalSfsEmpleado +
      params.totalAfpEmpleado +
      params.totalIsr +
      params.totalOtrasDeducciones +
      params.totalSfsEmpleador +
      params.totalAfpEmpleador +
      params.totalInfotep;

    const lineas = [
      this.lineaSegunSigno(cuentaGastoNomina.id, costoLaboral, 'debito', `Nómina — período ${params.periodoId}`),
      this.lineaSegunSigno(cuentaCaja.id, params.totalSalarioNeto, 'credito', `Nómina — período ${params.periodoId}`),
      this.lineaSegunSigno(cuentaTssIsr.id, porPagarTssIsr, 'credito', `Nómina — período ${params.periodoId}`),
    ];

    return this.crearAsientoAutomatico({
      tenantId: params.tenantId,
      concepto: `Nómina pagada — período ${params.periodoId}`,
      origen: 'NOMINA',
      origenId: params.periodoId,
      lineas,
    });
  }

  /** Pago (parcial o total) recibido de un cliente contra una factura a crédito -> mueve de Cuentas por Cobrar a Caja/Bancos. */
  async generarDesdePagoFactura(params: { tenantId: string; pagoId: string; monto: number }) {
    const [cuentaCaja, cuentaCobro] = await Promise.all([
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.CAJA_BANCOS),
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.CUENTAS_POR_COBRAR),
    ]);

    const lineas = [
      this.lineaSegunSigno(cuentaCaja.id, params.monto, 'debito', `Pago recibido — ${params.pagoId}`),
      this.lineaSegunSigno(cuentaCobro.id, params.monto, 'credito', `Pago recibido — ${params.pagoId}`),
    ];

    return this.crearAsientoAutomatico({
      tenantId: params.tenantId,
      concepto: `Pago recibido — ${params.pagoId}`,
      origen: 'PAGO',
      origenId: params.pagoId,
      lineas,
    });
  }

  /**
   * Pago (parcial o total) hecho a un proveedor contra una orden de compra
   * -> mueve de Caja/Bancos a Cuentas por Pagar. Si el pago retuvo ISR y/o
   * ITBIS al proveedor (Art. 309/349 — ver PagosService.registrarPagoOrdenCompra),
   * esa porción no sale de Caja: se acredita a las cuentas de retención en
   * vez de a Caja, para declarar y remitir aparte a la DGII. El débito a
   * Cuentas por Pagar es siempre el monto BRUTO (lo que salda la orden);
   * Caja solo se mueve por el neto efectivamente desembolsado.
   */
  async generarDesdePagoOrdenCompra(params: { tenantId: string; pagoId: string; monto: number; retencionIsr?: number; retencionItbis?: number }) {
    const retencionIsr = params.retencionIsr ?? 0;
    const retencionItbis = params.retencionItbis ?? 0;
    const netoCaja = params.monto - retencionIsr - retencionItbis;
    const descripcion = `Pago a proveedor — ${params.pagoId}`;

    const [cuentaPorPagar, cuentaCaja, cuentaIsrRetenido, cuentaItbisRetenido] = await Promise.all([
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.CUENTAS_POR_PAGAR),
      this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.CAJA_BANCOS),
      retencionIsr > 0 ? this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.ISR_RETENIDO_TERCEROS) : null,
      retencionItbis > 0 ? this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.ITBIS_RETENIDO_TERCEROS) : null,
    ]);

    const lineas = [this.lineaSegunSigno(cuentaPorPagar.id, params.monto, 'debito', descripcion)];
    if (netoCaja > EPSILON) {
      lineas.push(this.lineaSegunSigno(cuentaCaja.id, netoCaja, 'credito', descripcion));
    }
    if (cuentaIsrRetenido) {
      lineas.push(this.lineaSegunSigno(cuentaIsrRetenido.id, retencionIsr, 'credito', descripcion));
    }
    if (cuentaItbisRetenido) {
      lineas.push(this.lineaSegunSigno(cuentaItbisRetenido.id, retencionItbis, 'credito', descripcion));
    }

    return this.crearAsientoAutomatico({
      tenantId: params.tenantId,
      concepto: descripcion,
      origen: 'PAGO',
      origenId: params.pagoId,
      lineas,
    });
  }

  /**
   * Gasto menor (ver GastosMenoresService) -> un débito por cada línea de
   * gasto a su propia cuenta contable, un débito agregado a ITBIS
   * Adelantado (si aplica), y un crédito a la cuenta contable vinculada a
   * la cuenta bancaria de origen por el total. `lineas` ya viene con
   * `valor * cantidad` resuelto (sin ITBIS) — el ITBIS se agrega aparte,
   * mismo patrón que `generarDesdeCompra`.
   */
  async generarDesdeGastoMenor(params: {
    tenantId: string;
    gastoMenorId: string;
    cuentaBancariaCuentaContableId: string;
    itbis: number;
    lineas: { cuentaContableId: string; monto: number }[];
  }) {
    const descripcion = `Gasto menor — ${params.gastoMenorId}`;
    const lineas = params.lineas.map((l) => this.lineaSegunSigno(l.cuentaContableId, l.monto, 'debito', descripcion));

    if (params.itbis !== 0) {
      const cuentaItbis = await this.cuentasRepository.buscarPorCodigoGlobal(params.tenantId, CODIGOS_CUENTA.ITBIS_ADELANTADO);
      lineas.push(this.lineaSegunSigno(cuentaItbis.id, params.itbis, 'debito', descripcion));
    }

    const total = params.lineas.reduce((acc, l) => acc + l.monto, 0) + params.itbis;
    lineas.push(this.lineaSegunSigno(params.cuentaBancariaCuentaContableId, total, 'credito', descripcion));

    return this.crearAsientoAutomatico({
      tenantId: params.tenantId,
      concepto: descripcion,
      origen: 'GASTO_MENOR',
      origenId: params.gastoMenorId,
      lineas,
    });
  }

  /**
   * "Gasto rápido": envoltorio amigable sobre `crear()` para quien no
   * conoce partida doble — el usuario solo elige la cuenta de gasto y de
   * dónde sale el dinero (Caja/Bancos si es al contado, Cuentas por Pagar
   * si es a crédito), y acá se construyen las dos líneas balanceadas.
   */
  async crearGasto(dto: CrearGastoDto, tenantId: string) {
    const lineas = [
      { cuentaContableId: dto.cuentaGastoId, debito: dto.monto, credito: 0 },
      { cuentaContableId: dto.cuentaOrigenId, debito: 0, credito: dto.monto },
    ];
    this.validarBalance(lineas);
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    await this.validarPeriodoAbierto(fecha);

    return this.asientosRepository.crear({
      tenantId,
      concepto: dto.concepto,
      origen: 'GASTO',
      fecha,
      lineas,
    });
  }

  private async crearAsientoAutomatico(params: { tenantId: string; concepto: string; origen: 'FACTURA' | 'COMPRA' | 'NOMINA' | 'PAGO' | 'GASTO_MENOR'; origenId: string; lineas: LineaCalculada[] }) {
    this.validarBalance(params.lineas);
    return this.asientosRepository.crearGlobal(params);
  }

  /** monto>=0 va a `cuandoPositivo`; si es negativo (p. ej. una nota de crédito), se refleja en la cuenta contraria, con valor absoluto. */
  private lineaSegunSigno(cuentaContableId: string, monto: number, cuandoPositivo: 'debito' | 'credito', descripcion: string): LineaCalculada {
    const cuandoNegativo = cuandoPositivo === 'debito' ? 'credito' : 'debito';
    const columna = monto >= 0 ? cuandoPositivo : cuandoNegativo;
    return { cuentaContableId, debito: 0, credito: 0, [columna]: Math.abs(monto), descripcion } as LineaCalculada;
  }

  private async validarPeriodoAbierto(fecha: Date) {
    const ultimoCierre = await this.cierrePeriodoRepository.buscarUltimo();
    if (ultimoCierre && fecha <= ultimoCierre.fecha) {
      throw new BadRequestException(
        `No se puede registrar un asiento con fecha ${fecha.toISOString().slice(0, 10)} — el período hasta ${ultimoCierre.fecha.toISOString().slice(0, 10)} ya está cerrado`,
      );
    }
  }

  private validarBalance(lineas: { debito: number; credito: number }[]) {
    const totalDebito = lineas.reduce((acc, l) => acc + l.debito, 0);
    const totalCredito = lineas.reduce((acc, l) => acc + l.credito, 0);
    if (Math.abs(totalDebito - totalCredito) > EPSILON) {
      this.logger.error(`Asiento desbalanceado: débito=${totalDebito} crédito=${totalCredito}`);
      throw new BadRequestException(`El asiento no balancea: débito ${totalDebito.toFixed(2)} vs. crédito ${totalCredito.toFixed(2)}`);
    }
  }
}
