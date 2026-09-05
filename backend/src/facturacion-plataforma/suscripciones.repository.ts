import { Injectable } from '@nestjs/common';
import { EstadoSuscripcion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const INCLUDE_SUSCRIPCION = { plan: true } as const;

@Injectable()
export class SuscripcionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  buscarPorTenant(tenantId: string) {
    return this.prisma.suscripcion.findUniqueOrThrow({ where: { tenantId }, include: INCLUDE_SUSCRIPCION });
  }

  actualizar(tenantId: string, data: { feeMoraPct?: number; estado?: EstadoSuscripcion; primerPeriodoGratis?: boolean }) {
    return this.prisma.suscripcion.update({ where: { tenantId }, data, include: INCLUDE_SUSCRIPCION });
  }

  /** Se apaga sola una vez aplicada — ver FacturasPlataformaService.resolverDescuento. */
  desactivarPrimerPeriodoGratis(id: string) {
    return this.prisma.suscripcion.update({ where: { id }, data: { primerPeriodoGratis: false } });
  }

  listarActivasParaFacturar(hoy: Date) {
    return this.prisma.suscripcion.findMany({
      where: { estado: 'ACTIVA', fechaProximoCorte: { lte: hoy } },
      include: INCLUDE_SUSCRIPCION,
    });
  }

  avanzarProximoCorte(id: string, fechaProximoCorte: Date) {
    return this.prisma.suscripcion.update({ where: { id }, data: { fechaProximoCorte } });
  }
}
