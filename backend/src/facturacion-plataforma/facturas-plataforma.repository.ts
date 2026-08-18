import { Injectable } from '@nestjs/common';
import { EstadoFacturaPlataforma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginar } from '../common/types/pagina-resultado';

const INCLUDE_FACTURA = { tenant: { select: { id: true, nombre: true } } } as const;

@Injectable()
export class FacturasPlataformaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: { pagina?: number; tamanoPagina?: number; busqueda?: string; tenantId?: string; estado?: EstadoFacturaPlataforma }) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const where = {
      tenantId: query.tenantId,
      estado: query.estado,
      ...(query.busqueda
        ? {
            OR: [
              { concepto: { contains: query.busqueda, mode: 'insensitive' as const } },
              { tenant: { nombre: { contains: query.busqueda, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [datos, total] = await Promise.all([
      this.prisma.facturaPlataforma.findMany({
        where,
        include: INCLUDE_FACTURA,
        orderBy: { fechaEmision: 'desc' },
        skip,
        take,
      }),
      this.prisma.facturaPlataforma.count({ where }),
    ]);

    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.prisma.facturaPlataforma.findUniqueOrThrow({
      where: { id },
      include: { ...INCLUDE_FACTURA, suscripcion: { include: { plan: true } }, lineas: { orderBy: { orden: 'asc' } } },
    });
  }

  crear(data: {
    tenantId: string;
    suscripcionId: string;
    concepto: string;
    monto: number;
    total: number;
    fechaEmision: Date;
    fechaVencimiento: Date;
    lineas?: { concepto: string; monto: number }[];
  }) {
    const { lineas, ...resto } = data;
    return this.prisma.facturaPlataforma.create({
      data: {
        ...resto,
        ...(lineas ? { lineas: { create: lineas.map((l, i) => ({ concepto: l.concepto, monto: l.monto, orden: i })) } } : {}),
      },
      include: { ...INCLUDE_FACTURA, lineas: { orderBy: { orden: 'asc' } } },
    });
  }

  actualizar(id: string, data: { concepto?: string; descuento?: number; montoMora?: number; total?: number; fechaVencimiento?: Date }) {
    return this.prisma.facturaPlataforma.update({ where: { id }, data, include: INCLUDE_FACTURA });
  }

  marcarEstado(id: string, estado: EstadoFacturaPlataforma, fechaPago?: Date) {
    return this.prisma.facturaPlataforma.update({ where: { id }, data: { estado, fechaPago } });
  }

  contarPagos(facturaId: string) {
    return this.prisma.pagoPlataforma.count({ where: { facturaId } });
  }

  listarVencidasPendientes(hoy: Date) {
    return this.prisma.facturaPlataforma.findMany({
      where: { estado: 'PENDIENTE', fechaVencimiento: { lt: hoy } },
      include: { suscripcion: true, tenant: true },
    });
  }
}
