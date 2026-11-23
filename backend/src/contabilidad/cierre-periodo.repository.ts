import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class CierrePeriodoRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listar() {
    return this.db.periodoContable.findMany({ orderBy: { fechaInicio: 'desc' }, include: { asientoCierre: { include: { lineas: true } } } });
  }

  buscarPorFecha(fecha: Date) {
    return this.db.periodoContable.findFirst({ where: { fechaInicio: { lte: fecha }, fechaFin: { gte: fecha } } });
  }

  buscarAbiertoMasAntiguo() {
    return this.db.periodoContable.findFirst({ where: { estado: 'ABIERTO' }, orderBy: { fechaInicio: 'asc' } });
  }

  /** El de `fechaInicio` más reciente — no necesariamente ABIERTO (si el cron se atrasó, puede que el último exista y ya esté cerrado, o no exista ninguno que cubra hoy). Base para `completarFaltantes`. */
  buscarMasReciente() {
    return this.db.periodoContable.findFirst({ orderBy: { fechaInicio: 'desc' } });
  }

  buscarPorId(id: string) {
    return this.db.periodoContable.findUniqueOrThrow({ where: { id } });
  }

  /** Asistente de pre-cierre (docs/PLAN.md) — turnos de POS sin cerrar/revisar abiertos dentro del rango. No genera ningún asiento (ver AsientosContablesService) — es un control de efectivo, no un riesgo contable. */
  turnosSinCerrarEnRango(desde: Date, hasta: Date) {
    return this.db.turnoCaja.findMany({
      where: { estado: { in: ['ABIERTO', 'PENDIENTE_REVISION'] }, abiertoEn: { gte: desde, lte: hasta } },
      orderBy: { abiertoEn: 'asc' },
      include: { bodega: { select: { nombre: true } }, cajero: { select: { nombre: true } } },
    });
  }

  /** Asistente de pre-cierre — cotizaciones sin convertir (ni rechazadas/vencidas) dentro del rango. Recordatorio comercial, no riesgo contable: una cotización nunca generó ningún asiento. */
  cotizacionesSinConvertirEnRango(desde: Date, hasta: Date) {
    return this.db.cotizacion.findMany({
      where: { facturaId: null, estado: { in: ['BORRADOR', 'ENVIADA'] }, createdAt: { gte: desde, lte: hasta } },
      orderBy: { createdAt: 'asc' },
      include: { cliente: { select: { nombre: true } } },
    });
  }

  /** Asistente de pre-cierre — remisiones ENTREGADA sin facturar dentro del rango: el caso real ("se entregó, nunca se cobró"), a diferencia de una BORRADOR (nada salió todavía). */
  remisionesSinFacturarEnRango(desde: Date, hasta: Date) {
    return this.db.remision.findMany({
      where: { facturaId: null, estado: 'ENTREGADA', fecha: { gte: desde, lte: hasta } },
      orderBy: { fecha: 'asc' },
      include: { cliente: { select: { nombre: true } } },
    });
  }

  crear(params: { tenantId: string; fechaInicio: Date; fechaFin: Date }) {
    return this.db.periodoContable.create({ data: params });
  }

  cerrar(id: string, params: { utilidadNeta: number; asientoCierreId: string }) {
    return this.db.periodoContable.update({
      where: { id },
      data: { estado: 'CERRADO', ...params },
      include: { asientoCierre: { include: { lineas: true } } },
    });
  }
}
