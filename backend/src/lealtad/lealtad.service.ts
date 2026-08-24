import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LealtadRepository } from './lealtad.repository';
import { ActualizarConfiguracionLealtadDto } from './dto/actualizar-configuracion-lealtad.dto';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

interface LineaParaPuntos {
  cantidad: Prisma.Decimal;
  precioUnitario: Prisma.Decimal;
  descuento: Prisma.Decimal;
  montoItbis: Prisma.Decimal;
}

@Injectable()
export class LealtadService {
  constructor(private readonly lealtadRepository: LealtadRepository) {}

  obtenerConfiguracion() {
    return this.lealtadRepository.obtenerConfiguracion();
  }

  actualizarConfiguracion(tenantId: string, dto: ActualizarConfiguracionLealtadDto) {
    const modo = dto.modoAcumulacion ?? 'POR_MONTO';
    if (modo === 'POR_MONTO' && dto.montoPorPunto == null) {
      throw new BadRequestException('montoPorPunto es obligatorio cuando modoAcumulacion=POR_MONTO');
    }
    return this.lealtadRepository.actualizarConfiguracion(tenantId, dto);
  }

  historialCliente(clienteId: string) {
    return this.lealtadRepository.historialCliente(clienteId);
  }

  ajusteManual(tenantId: string, clienteId: string, puntos: number, motivo: string) {
    return this.lealtadRepository.ajusteManual(tenantId, clienteId, puntos, motivo);
  }

  /**
   * Ítem A-3 — reactor de `factura.creada` (ver LealtadEventosService).
   * Solo acumula si el programa está activo y es una venta nueva
   * (CONTADO/CREDITO) — una Nota de Crédito/Débito no genera sus propios
   * puntos.
   */
  async generarDesdeFactura(params: { tenantId: string; facturaId: string; clienteId: string; tipoFactura: string }) {
    if (params.tipoFactura !== 'CONTADO' && params.tipoFactura !== 'CREDITO') return;

    const config = await this.lealtadRepository.buscarConfiguracionGlobal(params.tenantId);
    if (!config?.activo) return;

    const lineas: LineaParaPuntos[] = await this.lealtadRepository.buscarLineasFacturaGlobal(params.facturaId);
    const lineasCalificantes = config.itemsConDescuentoGeneranPuntos ? lineas : lineas.filter((l) => Number(l.descuento) === 0);
    if (lineasCalificantes.length === 0) return;

    const puntos = this.calcularPuntosGanados(config, lineasCalificantes);
    if (puntos <= 0) return;

    const expiraEn = config.diasExpiracion ? new Date(Date.now() + config.diasExpiracion * MS_POR_DIA) : null;
    await this.lealtadRepository.acumularGlobal(params.tenantId, params.clienteId, puntos, params.facturaId, expiraEn);
  }

  private calcularPuntosGanados(
    config: { modoAcumulacion: string; montoPorPunto: Prisma.Decimal | null; calcularSobre: string },
    lineas: LineaParaPuntos[],
  ): number {
    if (config.modoAcumulacion === 'POR_UNIDAD') {
      return Math.floor(lineas.reduce((acc, l) => acc + Number(l.cantidad), 0));
    }
    if (!config.montoPorPunto || Number(config.montoPorPunto) <= 0) return 0;
    const base = lineas.reduce((acc, l) => {
      const neto = Number(l.cantidad) * Number(l.precioUnitario) - Number(l.descuento);
      return acc + (config.calcularSobre === 'TOTAL' ? neto + Number(l.montoItbis) : neto);
    }, 0);
    return Math.floor(base / Number(config.montoPorPunto));
  }

  /** Reactor de `factura.anulada`. */
  async anularPorFactura(tenantId: string, facturaId: string) {
    const movimientos = await this.lealtadRepository.buscarMovimientosDeFacturaGlobal(tenantId, facturaId);
    for (const m of movimientos) {
      await this.lealtadRepository.anularMovimientoGlobal(m);
    }
  }

  /**
   * Canje de puntos como forma de pago (Fase 4c-style, ítem A-3) —
   * llamado desde `FacturacionService.crear()` dentro de SU misma
   * transacción, una vez por cada línea de `pagos` cuya FormaPago tenga
   * `esPuntosLealtad`. Mismo criterio que `BonosService.
   * procesarPagoEnTx`: valida y descuenta atómicamente, sin tabla de
   * "solicitud de canje" intermedia.
   */
  async procesarPagoEnTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    clienteId: string,
    facturaId: string,
    pago: { formaPagoId: string; monto: number },
  ) {
    const formaPago = await tx.formaPago.findUnique({ where: { id: pago.formaPagoId }, select: { esPuntosLealtad: true } });
    if (!formaPago?.esPuntosLealtad) return;

    const config = await this.lealtadRepository.buscarConfiguracionEnTx(tx, tenantId);
    if (!config?.activo) {
      throw new BadRequestException('El programa de lealtad no está activo');
    }
    const valorPunto = Number(config.valorPunto);
    if (valorPunto <= 0) {
      throw new BadRequestException('El programa de lealtad no tiene configurado el valor del punto');
    }
    const puntosNecesarios = Math.ceil(pago.monto / valorPunto);
    if (puntosNecesarios < config.minimoParaCanjear) {
      throw new BadRequestException(`El canje mínimo es de ${config.minimoParaCanjear} puntos`);
    }

    const cliente = await this.lealtadRepository.buscarClienteEnTx(tx, clienteId);
    if (cliente.puntosLealtad < puntosNecesarios) {
      throw new BadRequestException(
        `El cliente no tiene puntos suficientes (disponibles: ${cliente.puntosLealtad}, necesarios: ${puntosNecesarios})`,
      );
    }

    await this.lealtadRepository.canjearEnTx(tx, tenantId, clienteId, puntosNecesarios, facturaId);
  }
}
