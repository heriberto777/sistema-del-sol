import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarConfiguracionLealtadDto } from './dto/actualizar-configuracion-lealtad.dto';

@Injectable()
export class LealtadRepository {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  // ---- Contexto HTTP (this.db, tenant-scoped automático) ----

  obtenerConfiguracion() {
    return this.db.configuracionLealtad.findFirst();
  }

  actualizarConfiguracion(tenantId: string, dto: ActualizarConfiguracionLealtadDto) {
    return this.db.configuracionLealtad.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });
  }

  historialCliente(clienteId: string) {
    return this.db.movimientoLealtad.findMany({ where: { clienteId }, orderBy: { createdAt: 'desc' } });
  }

  /** Ajuste manual (admin) — create+update atómico, mismo criterio que cualquier escritura de dos tablas en este proyecto. */
  ajusteManual(tenantId: string, clienteId: string, puntos: number, motivo: string) {
    return this.db.$transaction(async (tx) => {
      await tx.movimientoLealtad.create({
        data: { tenantId, clienteId, tipo: 'AJUSTE', puntos, puntosDisponibles: puntos > 0 ? puntos : 0, motivo },
      });
      await tx.cliente.update({ where: { id: clienteId }, data: { puntosLealtad: { increment: puntos } } });
    });
  }

  // ---- Contexto reactor de eventos (this.prisma global + tenantId explícito, fuera de request — mismo criterio que ComisionesRepository) ----

  buscarConfiguracionGlobal(tenantId: string) {
    return this.prisma.configuracionLealtad.findUnique({ where: { tenantId } });
  }

  buscarLineasFacturaGlobal(facturaId: string) {
    return this.prisma.lineaFactura.findMany({
      where: { facturaId },
      select: { cantidad: true, precioUnitario: true, descuento: true, montoItbis: true },
    });
  }

  async acumularGlobal(tenantId: string, clienteId: string, puntos: number, facturaId: string, expiraEn: Date | null) {
    await this.prisma.movimientoLealtad.create({
      data: { tenantId, clienteId, tipo: 'ACUMULACION', puntos, puntosDisponibles: puntos, facturaId, expiraEn },
    });
    await this.prisma.cliente.update({ where: { id: clienteId }, data: { puntosLealtad: { increment: puntos } } });
  }

  buscarMovimientosDeFacturaGlobal(tenantId: string, facturaId: string) {
    return this.prisma.movimientoLealtad.findMany({ where: { tenantId, facturaId, anulado: false } });
  }

  /**
   * Reversión al anular una factura (ítem A-3): una ACUMULACION de ESA
   * venta pierde lo que le quede sin canjear/expirar; un CANJE de ESA
   * venta se reintegra como una nueva ACUMULACION sin fecha de
   * expiración (un reintegro no debería traer un vencimiento arbitrario)
   * — no reconstruye los lotes EXACTOS que ese canje consumió en su
   * momento (limitación conocida, documentada en ARCHITECTURE.md), pero
   * el saldo del cliente siempre queda numéricamente correcto.
   */
  async anularMovimientoGlobal(m: { id: string; tenantId: string; clienteId: string; tipo: string; puntos: number; puntosDisponibles: number }) {
    if (m.tipo === 'ACUMULACION') {
      if (m.puntosDisponibles > 0) {
        await this.prisma.cliente.update({ where: { id: m.clienteId }, data: { puntosLealtad: { decrement: m.puntosDisponibles } } });
      }
      await this.prisma.movimientoLealtad.update({ where: { id: m.id }, data: { anulado: true, puntosDisponibles: 0 } });
    } else if (m.tipo === 'CANJE') {
      const puntosARestituir = Math.abs(m.puntos);
      await this.prisma.movimientoLealtad.create({
        data: {
          tenantId: m.tenantId,
          clienteId: m.clienteId,
          tipo: 'ACUMULACION',
          puntos: puntosARestituir,
          puntosDisponibles: puntosARestituir,
          motivo: `Reintegro por anulación de la venta que canjeó estos puntos`,
        },
      });
      await this.prisma.cliente.update({ where: { id: m.clienteId }, data: { puntosLealtad: { increment: puntosARestituir } } });
      await this.prisma.movimientoLealtad.update({ where: { id: m.id }, data: { anulado: true } });
    }
  }

  // ---- Contexto transacción abierta por FacturacionService.crear() (canje al pagar, mismo patrón que BonosService.procesarPagoEnTx) ----

  buscarConfiguracionEnTx(tx: Prisma.TransactionClient, tenantId: string) {
    return tx.configuracionLealtad.findUnique({ where: { tenantId } });
  }

  buscarClienteEnTx(tx: Prisma.TransactionClient, clienteId: string) {
    return tx.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { puntosLealtad: true } });
  }

  /**
   * Consume los puntos más próximos a vencer primero (o los más viejos
   * si no expiran) — mismo criterio FEFO que el consumo de lotes de
   * inventario.
   */
  async canjearEnTx(tx: Prisma.TransactionClient, tenantId: string, clienteId: string, puntos: number, facturaId: string) {
    const lotes = await tx.movimientoLealtad.findMany({
      where: { tenantId, clienteId, tipo: 'ACUMULACION', anulado: false, puntosDisponibles: { gt: 0 } },
      orderBy: [{ expiraEn: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    });
    let restante = puntos;
    for (const lote of lotes) {
      if (restante <= 0) break;
      const consumir = Math.min(lote.puntosDisponibles, restante);
      await tx.movimientoLealtad.update({ where: { id: lote.id }, data: { puntosDisponibles: lote.puntosDisponibles - consumir } });
      restante -= consumir;
    }
    await tx.movimientoLealtad.create({ data: { tenantId, clienteId, tipo: 'CANJE', puntos: -puntos, facturaId } });
    await tx.cliente.update({ where: { id: clienteId }, data: { puntosLealtad: { decrement: puntos } } });
  }
}
