import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BonosRepository } from './bonos.repository';
import { EmitirLoteBonosDto } from './dto/emitir-lote-bonos.dto';
import { generarCodigoBono } from './generar-codigo-bono';

/** Tolerancia de redondeo, mismo criterio que EPSILON en PagosService/FacturacionService. */
const EPSILON = 0.005;

@Injectable()
export class BonosService {
  constructor(private readonly bonosRepository: BonosRepository) {}

  /** Códigos únicos DENTRO del lote — colisionar contra el historial completo de bonos es astronómicamente improbable con 32^8 combinaciones (ver generarCodigoBono), no vale la pena una vuelta a la base por cada uno. */
  async emitirLote(dto: EmitirLoteBonosDto, tenantId: string) {
    const codigos = new Set<string>();
    while (codigos.size < dto.cantidad) {
      codigos.add(generarCodigoBono());
    }
    const bonos = [...codigos].map((codigo) => ({
      tenantId,
      codigo,
      montoInicial: dto.montoPorBono,
      fechaVencimiento: dto.fechaVencimiento,
    }));
    return this.bonosRepository.crearLote(bonos);
  }

  listar(busqueda?: string) {
    return this.bonosRepository.listar(busqueda);
  }

  async anular(id: string) {
    const bono = await this.bonosRepository.buscarPorId(id);
    if (bono.estado === 'ANULADO') {
      throw new BadRequestException('Este bono ya está anulado');
    }
    return this.bonosRepository.anular(id);
  }

  /**
   * Único punto donde un pago realmente distinto de "referencia libre"
   * tiene efecto real (Fase 4c) — llamado desde
   * FacturacionService.crear() dentro de SU misma transacción, una vez
   * por cada línea de `pagos` cuya FormaPago tenga `esBono`. Sin tabla de
   * movimientos propia: el ledger de canjes YA es `PagoVenta` (filtrado
   * por `formaPago.esBono` + `referencia = codigo`, ver ARCHITECTURE.md)
   * — acá solo se valida y se descuenta `saldoActual` atómicamente.
   */
  async procesarPagoEnTx(tx: Prisma.TransactionClient, tenantId: string, pago: { formaPagoId: string; monto: number; referencia?: string }) {
    const formaPago = await tx.formaPago.findUnique({ where: { id: pago.formaPagoId }, select: { esBono: true } });
    if (!formaPago?.esBono) return;

    if (!pago.referencia) {
      throw new BadRequestException('Pagar con Bono requiere el código del bono');
    }
    const bono = await this.bonosRepository.buscarPorCodigoEnTx(tx, tenantId, pago.referencia);
    if (!bono) {
      throw new BadRequestException(`No existe ningún bono con el código ${pago.referencia}`);
    }
    if (bono.estado === 'ANULADO') {
      throw new BadRequestException(`El bono ${pago.referencia} fue anulado`);
    }
    if (bono.estado === 'VENCIDO' || bono.fechaVencimiento < new Date()) {
      throw new BadRequestException(`El bono ${pago.referencia} ya venció`);
    }
    const saldoActual = Number(bono.saldoActual);
    if (saldoActual < pago.monto - EPSILON) {
      throw new BadRequestException(`El bono ${pago.referencia} no tiene saldo suficiente (disponible: RD$ ${saldoActual.toFixed(2)})`);
    }

    const saldoNuevo = Math.max(saldoActual - pago.monto, 0);
    await this.bonosRepository.descontarSaldoEnTx(tx, bono.id, saldoNuevo, saldoNuevo <= EPSILON ? 'AGOTADO' : 'ACTIVO');
  }
}
