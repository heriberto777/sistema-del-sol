import { Injectable } from '@nestjs/common';
import { ReportesFiscalesRepository } from './reportes-fiscales.repository';
import { generarTxtFiscal, formatoFechaDgii, formatoMontoDgii } from './exportador-fiscal';

function rangoPorDefecto(desde?: string, hasta?: string): { desde: Date; hasta: Date } {
  const hastaFecha = hasta ? new Date(hasta) : new Date();
  const desdeFecha = desde ? new Date(desde) : new Date(hastaFecha.getFullYear(), hastaFecha.getMonth(), 1);
  return { desde: desdeFecha, hasta: hastaFecha };
}

@Injectable()
export class ReportesFiscalesService {
  constructor(private readonly repository: ReportesFiscalesRepository) {}

  async formato607(desde?: string, hasta?: string) {
    const rango = rangoPorDefecto(desde, hasta);
    const facturas = await this.repository.ventasEnRango(rango.desde, rango.hasta);

    const filas = facturas.map((f) => ({
      rncCedula: f.cliente.rncCedula ?? '',
      ncf: f.ncf ?? '',
      fecha: f.fecha,
      tipoIngreso: '01', // no se clasifica el tipo de ingreso todavía — default "ingresos por operaciones"
      montoFacturado: Number(f.subtotal),
      itbisFacturado: Number(f.itbis),
      total: Number(f.total),
    }));

    const resumen = filas.reduce(
      (acc, f) => ({ cantidad: acc.cantidad + 1, montoFacturado: acc.montoFacturado + f.montoFacturado, itbisFacturado: acc.itbisFacturado + f.itbisFacturado }),
      { cantidad: 0, montoFacturado: 0, itbisFacturado: 0 },
    );

    return { filas, resumen, rango };
  }

  async exportar607Txt(desde?: string, hasta?: string): Promise<string> {
    const { filas } = await this.formato607(desde, hasta);
    return generarTxtFiscal(
      filas.map((f) => [
        f.rncCedula,
        f.ncf,
        formatoFechaDgii(f.fecha),
        f.tipoIngreso,
        formatoMontoDgii(f.montoFacturado),
        formatoMontoDgii(f.itbisFacturado),
      ]),
    );
  }

  async formato608(desde?: string, hasta?: string) {
    const rango = rangoPorDefecto(desde, hasta);
    const anuladas = await this.repository.anuladasEnRango(rango.desde, rango.hasta);

    const filas = anuladas.map((f) => ({
      ncf: f.ncf ?? '',
      fecha: f.fecha,
      tipoAnulacion: '01', // no se rastrea el motivo específico de anulación todavía
    }));

    return { filas, resumen: { cantidad: filas.length }, rango };
  }

  async exportar608Txt(desde?: string, hasta?: string): Promise<string> {
    const { filas } = await this.formato608(desde, hasta);
    return generarTxtFiscal(filas.map((f) => [f.ncf, formatoFechaDgii(f.fecha), f.tipoAnulacion]));
  }

  async formato606(desde?: string, hasta?: string) {
    const rango = rangoPorDefecto(desde, hasta);
    const [recepciones, gastosMenores] = await Promise.all([
      this.repository.comprasRecibidasEnRango(rango.desde, rango.hasta),
      this.repository.gastosMenoresEnRango(rango.desde, rango.hasta),
    ]);

    const filasCompras = recepciones.map((r) => {
      const montoFacturado = r.lineas.reduce((acc, l) => acc + Number(l.costoUnitario) * Number(l.cantidadRecibida), 0);
      const itbisFacturado = r.lineas.reduce(
        (acc, l) => acc + Number(l.costoUnitario) * Number(l.cantidadRecibida) * (Number(l.producto.porcentajeItbis) / 100),
        0,
      );
      return {
        rncProveedor: r.ordenCompra.proveedor.rnc ?? '',
        numeroComprobante: r.facturaProveedorNumero ?? '',
        fecha: r.fecha,
        montoFacturado,
        itbisFacturado,
      };
    });

    // Mercado informal (NCF B11/E43, ver GastoMenor) — sin RNC de proveedor.
    const filasGastosMenores = gastosMenores.map((g) => ({
      rncProveedor: '',
      numeroComprobante: g.ncf ?? '',
      fecha: g.fecha,
      montoFacturado: Number(g.monto),
      itbisFacturado: Number(g.itbis),
    }));

    const filas = [...filasCompras, ...filasGastosMenores].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    const resumen = filas.reduce(
      (acc, f) => ({ cantidad: acc.cantidad + 1, montoFacturado: acc.montoFacturado + f.montoFacturado, itbisFacturado: acc.itbisFacturado + f.itbisFacturado }),
      { cantidad: 0, montoFacturado: 0, itbisFacturado: 0 },
    );

    return { filas, resumen, rango };
  }

  async exportar606Txt(desde?: string, hasta?: string): Promise<string> {
    const { filas } = await this.formato606(desde, hasta);
    return generarTxtFiscal(
      filas.map((f) => [
        f.rncProveedor,
        f.numeroComprobante,
        formatoFechaDgii(f.fecha),
        formatoMontoDgii(f.montoFacturado),
        formatoMontoDgii(f.itbisFacturado),
      ]),
    );
  }

  /** No es un formato DGII per se — es el neto de ITBIS (607 - 606) que alimenta la declaración de ITBIS. */
  async resumenItbis(desde?: string, hasta?: string) {
    const [ventas, compras] = await Promise.all([this.formato607(desde, hasta), this.formato606(desde, hasta)]);
    return {
      rango: ventas.rango,
      itbisEnVentas: ventas.resumen.itbisFacturado,
      itbisEnCompras: compras.resumen.itbisFacturado,
      itbisNetoAPagar: ventas.resumen.itbisFacturado - compras.resumen.itbisFacturado,
    };
  }

  /**
   * Resumen de la posición de ITBIS del período en los renglones que pide la
   * declaración jurada de ITBIS (IT-1) de la DGII: ITBIS en ventas, ITBIS en
   * compras, y si el neto es a pagar o a favor. No es el formulario IT-1
   * oficial línea por línea (se presenta en la Oficina Virtual de la DGII,
   * no como archivo) — es la misma limitación que exportador-fiscal.ts
   * documenta para 606/607/608: los montos son reales, el layout exacto del
   * formulario no está verificado byte a byte.
   */
  async formatoIT1(desde?: string, hasta?: string) {
    const resumen = await this.resumenItbis(desde, hasta);
    const neto = resumen.itbisNetoAPagar;
    return {
      rango: resumen.rango,
      itbisEnVentas: resumen.itbisEnVentas,
      itbisEnCompras: resumen.itbisEnCompras,
      itbisAPagar: neto > 0 ? neto : 0,
      itbisSaldoAFavor: neto < 0 ? -neto : 0,
    };
  }

  /**
   * Resumen de ISR/ITBIS retenido a proveedores por servicios (Art. 309/349
   * — ver PagosService.registrarPagoOrdenCompra) en el rango. Junto con
   * retencionesNomina() cubre las dos secciones de la declaración mensual
   * de retenciones que pide la DGII (formulario IR-17). No es el layout
   * oficial del formulario, igual que formatoIT1()/retencionesNomina(): son
   * los montos reales, listos para pasar a la declaración correspondiente.
   */
  async retencionesProveedores(desde?: string, hasta?: string) {
    const rango = rangoPorDefecto(desde, hasta);
    const pagos = await this.repository.retencionesProveedoresEnRango(rango.desde, rango.hasta);

    const filas = pagos.map((p) => ({
      proveedorNombre: p.ordenCompra?.proveedor.nombre ?? '',
      proveedorRnc: p.ordenCompra?.proveedor.rnc ?? '',
      fecha: p.fecha,
      montoBruto: Number(p.monto),
      retencionIsr: Number(p.retencionIsr),
      retencionItbis: Number(p.retencionItbis),
      netoPagado: Number(p.monto) - Number(p.retencionIsr) - Number(p.retencionItbis),
    }));

    const resumen = filas.reduce(
      (acc, f) => ({
        cantidad: acc.cantidad + 1,
        montoBruto: acc.montoBruto + f.montoBruto,
        retencionIsr: acc.retencionIsr + f.retencionIsr,
        retencionItbis: acc.retencionItbis + f.retencionItbis,
        netoPagado: acc.netoPagado + f.netoPagado,
      }),
      { cantidad: 0, montoBruto: 0, retencionIsr: 0, retencionItbis: 0, netoPagado: 0 },
    );

    return { rango, filas, resumen };
  }

  /**
   * Resumen de ISR retenido sobre nómina por empleado en el rango (por
   * defecto, el mes en curso) — la base para la declaración mensual de
   * retenciones de asalariados que la DGII pide (formulario de
   * retenciones/IR-17). No es el layout oficial del formulario, igual que
   * formatoIT1(): son los montos reales, agrupados por empleado, listos
   * para pasar a la declaración correspondiente.
   */
  async retencionesNomina(tenantId: string, desde?: string, hasta?: string) {
    const rango = rangoPorDefecto(desde, hasta);
    const recibos = await this.repository.retencionesNominaEnRango(tenantId, rango.desde, rango.hasta);

    const porEmpleado = new Map<string, { cedula: string; nombre: string; salarioBruto: number; isr: number }>();
    for (const recibo of recibos) {
      const actual = porEmpleado.get(recibo.empleadoId) ?? { cedula: recibo.empleado.cedula, nombre: recibo.empleado.nombre, salarioBruto: 0, isr: 0 };
      actual.salarioBruto += Number(recibo.salarioBruto);
      actual.isr += Number(recibo.isr);
      porEmpleado.set(recibo.empleadoId, actual);
    }

    const empleados = Array.from(porEmpleado.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const resumen = empleados.reduce(
      (acc, e) => ({ salarioBruto: acc.salarioBruto + e.salarioBruto, isr: acc.isr + e.isr }),
      { salarioBruto: 0, isr: 0 },
    );

    return { rango, empleados, resumen };
  }
}
