import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearMetaVentaDto } from './dto/crear-meta-venta.dto';

const INCLUDE_META = { vendedor: { select: { id: true, nombre: true } } } as const;

@Injectable()
export class MetasVentaRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** Un vendedor solo puede tener una meta por mes — reenviar el mismo período actualiza el monto en vez de duplicar. */
  upsert(dto: CrearMetaVentaDto, tenantId: string) {
    return this.db.metaVentaCrm.upsert({
      where: { tenantId_vendedorId_anio_mes: { tenantId, vendedorId: dto.vendedorId, anio: dto.anio, mes: dto.mes } },
      create: { tenantId, vendedorId: dto.vendedorId, anio: dto.anio, mes: dto.mes, montoMeta: dto.montoMeta },
      update: { montoMeta: dto.montoMeta },
      include: INCLUDE_META,
    });
  }

  listarPorPeriodo(anio: number, mes: number) {
    return this.db.metaVentaCrm.findMany({ where: { anio, mes }, include: INCLUDE_META, orderBy: { vendedor: { nombre: 'asc' } } });
  }

  buscarPorId(id: string) {
    return this.db.metaVentaCrm.findUniqueOrThrow({ where: { id } });
  }

  eliminar(id: string) {
    return this.db.metaVentaCrm.delete({ where: { id } });
  }

  /** Mismo criterio que LeadsRepository.validarVendedorDelTenant — User es tenant-scoped, un id de otro tenant tira 404 acá. */
  validarVendedorDelTenant(id: string) {
    return this.db.user.findUniqueOrThrow({ where: { id }, select: { id: true } });
  }

  /** Alimenta el selector del frontend al definir una meta — mismo criterio que AuditoriaRepository.listarUsuariosConActividad: no depende de `admin.usuarios`. */
  listarVendedoresPosibles() {
    return this.db.user.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });
  }

  async montoGanadoPorVendedor(vendedorId: string, desde: Date, hasta: Date) {
    const resultado = await this.db.oportunidad.aggregate({
      where: { vendedorId, estado: 'GANADA', fechaCierreReal: { gte: desde, lte: hasta } },
      _sum: { montoEstimado: true },
    });
    return Number(resultado._sum.montoEstimado ?? 0);
  }
}
