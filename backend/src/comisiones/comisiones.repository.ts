import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';

interface FilaComisionInput {
  facturaId: string;
  lineaFacturaId: string;
  productoId: string;
  empleadoId: string;
  monto: number;
}

const INCLUDE_REPORTE = {
  factura: { select: { id: true, ncf: true, fecha: true, cliente: { select: { nombre: true } } } },
  empleado: { select: { id: true, nombre: true } },
  producto: { select: { id: true, codigo: true, nombre: true } },
} as const;

@Injectable()
export class ComisionesRepository {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /**
   * Llamado desde `ComisionesEventosService` (reactor de `factura.creada`,
   * fuera de un request HTTP) — usa el cliente global con `tenantId`
   * explícito, mismo criterio que `CuentasContablesRepository.
   * buscarPorCodigoGlobal`.
   */
  crearVarias(tenantId: string, filas: FilaComisionInput[]) {
    if (!filas.length) return Promise.resolve();
    return this.prisma.comisionVenta.createMany({
      data: filas.map((f) => ({ tenantId, ...f })),
    });
  }

  /** Llamado desde `ComisionesEventosService` al reaccionar a `factura.anulada`. */
  anularPorFactura(tenantId: string, facturaId: string) {
    return this.prisma.comisionVenta.updateMany({ where: { tenantId, facturaId }, data: { anulada: true } });
  }

  /**
   * Fuente única para los 3 reportes (por venta/vendedor/producto) —
   * `ComisionesService` agrega en JS sobre este mismo listado, mismo
   * criterio que `ReportesService.reporteVentas` (reduce en memoria, no
   * `groupBy` de Prisma). Corre en contexto de request (`this.db`,
   * tenant-scoped automático).
   */
  listar(desde: Date, hasta: Date) {
    return this.db.comisionVenta.findMany({
      where: { anulada: false, createdAt: { gte: desde, lte: hasta } },
      include: INCLUDE_REPORTE,
      orderBy: { createdAt: 'desc' },
    });
  }
}
