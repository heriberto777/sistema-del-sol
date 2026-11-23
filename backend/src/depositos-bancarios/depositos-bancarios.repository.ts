import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class DepositosBancariosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(params: {
    tenantId: string;
    numero: string;
    fecha: Date;
    cuentaBancariaId: string;
    monto: number;
    numeroComprobante?: string;
    bodegaId?: string;
    notas?: string;
    excedioSaldo: boolean;
    saldoDisponibleAlMomento: number;
    userId: string;
  }) {
    return this.db.depositoBancario.create({
      data: params,
      include: { cuentaBancaria: true, bodega: true },
    });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = params.busqueda
      ? {
          OR: [
            { numero: { contains: params.busqueda, mode: 'insensitive' as const } },
            { numeroComprobante: { contains: params.busqueda, mode: 'insensitive' as const } },
            { notas: { contains: params.busqueda, mode: 'insensitive' as const } },
          ],
        }
      : {};
    return Promise.all([
      this.db.depositoBancario.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { cuentaBancaria: true, bodega: true },
      }),
      this.db.depositoBancario.count({ where }),
    ]);
  }

  buscarPorId(id: string) {
    return this.db.depositoBancario.findUniqueOrThrow({
      where: { id },
      include: { cuentaBancaria: { include: { cuentaContable: true } }, bodega: true },
    });
  }

  actualizar(
    id: string,
    data: {
      fecha: Date;
      cuentaBancariaId: string;
      monto: number;
      numeroComprobante: string | null;
      bodegaId: string | null;
      notas: string | null;
      excedioSaldo: boolean;
      saldoDisponibleAlMomento: number;
    },
  ) {
    return this.db.depositoBancario.update({
      where: { id },
      data,
      include: { cuentaBancaria: true, bodega: true },
    });
  }

  marcarAnulado(id: string) {
    return this.db.depositoBancario.update({ where: { id }, data: { estado: 'ANULADO' } });
  }
}
