import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * A propósito usa `PrismaService` GLOBAL, nunca `TenantPrismaService` — el
 * controller público que consume esto corre sin JWT (`@Public()`), así
 * que no hay `request.user.tenantId` para que `TenantPrismaService`
 * resuelva (lanzaría `ForbiddenException`, ver tenant-prisma.service.ts).
 * Mismo criterio que los listeners de eventos: `PrismaService` global +
 * `tenantId` explícito en cada query (ver ARCHITECTURE.md).
 */
@Injectable()
export class SesionesCobroRepository {
  constructor(private readonly prisma: PrismaService) {}

  crear(data: { tenantId: string; facturaId: string; pasarela: string; referenciaExterna: string; monto: number; datosVerificacion?: string }) {
    return this.prisma.sesionCobroFactura.create({ data });
  }

  buscarPorReferencia(pasarela: string, referenciaExterna: string) {
    return this.prisma.sesionCobroFactura.findUnique({ where: { pasarela_referenciaExterna: { pasarela, referenciaExterna } } });
  }

  /**
   * Transición atómica `PENDIENTE → estadoDestino` (compare-and-swap vía
   * `updateMany({where:{estado:'PENDIENTE'}})` — Postgres serializa el
   * `UPDATE` por fila). Devuelve `true` solo para la llamada que de verdad
   * hizo el cambio — un reintento del mismo retorno (doble-click, replay)
   * ve `false` y no debe volver a registrar ningún `Pago`. Esto reemplaza
   * una transacción cruzada entre este `PrismaService` y el
   * `TenantPrismaService` que usa `FacturacionService.registrarPago`
   * (llamado DESPUÉS de ganar la transición) — no son el mismo cliente de
   * Prisma, no se pueden envolver juntos en un solo `$transaction`.
   */
  async intentarResolver(sesionId: string, estadoDestino: 'CONFIRMADO' | 'RECHAZADO'): Promise<boolean> {
    const { count } = await this.prisma.sesionCobroFactura.updateMany({
      where: { id: sesionId, estado: 'PENDIENTE' },
      data: { estado: estadoDestino },
    });
    return count === 1;
  }

  /** Si `registrarPago` falla DESPUÉS de ganar `intentarResolver('CONFIRMADO')`, la sesión vuelve a RECHAZADO — nunca queda "CONFIRMADO" sin un Pago real. */
  marcarRechazada(sesionId: string) {
    return this.prisma.sesionCobroFactura.update({ where: { id: sesionId }, data: { estado: 'RECHAZADO' } });
  }

  vincularPago(sesionId: string, pagoId: string) {
    return this.prisma.sesionCobroFactura.update({ where: { id: sesionId }, data: { pagoId } });
  }
}
