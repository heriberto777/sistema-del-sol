import { Injectable } from '@nestjs/common';
import { ModalidadFacturacion, Prisma, TipoNcf } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

interface LineaCalculada {
  cuentaContableId: string;
  concepto?: string;
  valor: number;
  porcentajeItbis: number;
  montoItbis: number;
  cantidad: number;
  montoTotal: number;
}

@Injectable()
export class GastosMenoresRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /**
   * `Tenant` no es un modelo tenant-scoped (es la tabla raíz) — se filtra
   * por `id` directo. Mismo cuerpo que
   * `FacturacionRepository.obtenerModalidadFacturacion` — duplicado a
   * propósito en vez de importar FacturacionModule por una consulta de
   * una línea (ver el plan de esta fase).
   */
  async obtenerModalidadFacturacion(tenantId: string): Promise<ModalidadFacturacion> {
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { modalidadFacturacion: true },
    });
    return tenant.modalidadFacturacion;
  }

  /**
   * Mismo cuerpo atómico que `FacturacionRepository.siguienteNcfEnTx` (ver
   * ese archivo para la explicación completa de por qué `{ increment: 1 }`
   * es seguro bajo concurrencia) — duplicado a propósito, no importado,
   * misma razón que `obtenerModalidadFacturacion` arriba.
   */
  async siguienteNumeroEnTx(tx: Prisma.TransactionClient, tipoNcf: TipoNcf): Promise<string> {
    const secuencia = await tx.ncfAsignado.findFirstOrThrow({
      where: { tipoNcf, activo: true },
    });
    const actualizada = await tx.ncfAsignado.update({
      where: { id: secuencia.id },
      data: { secuenciaActual: { increment: 1 } },
    });
    if (actualizada.secuenciaActual - 1 > actualizada.secuenciaFinal) {
      throw new Error(`Secuencia de NCF ${tipoNcf} agotada`);
    }
    return `${tipoNcf}${String(actualizada.secuenciaActual - 1).padStart(8, '0')}`;
  }

  async crearEnTx(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      ncf?: string;
      tipoNcf?: TipoNcf;
      notas?: string;
      fecha: Date;
      cuentaBancariaId: string;
      monto: number;
      itbis: number;
      total: number;
      lineas: LineaCalculada[];
    },
  ) {
    return tx.gastoMenor.create({
      data: {
        tenantId: params.tenantId,
        ncf: params.ncf,
        tipoNcf: params.tipoNcf,
        notas: params.notas,
        fecha: params.fecha,
        cuentaBancariaId: params.cuentaBancariaId,
        monto: params.monto,
        itbis: params.itbis,
        total: params.total,
        lineas: {
          create: params.lineas.map((linea) => ({
            cuentaContableId: linea.cuentaContableId,
            concepto: linea.concepto,
            valor: linea.valor,
            porcentajeItbis: linea.porcentajeItbis,
            montoItbis: linea.montoItbis,
            cantidad: linea.cantidad,
            montoTotal: linea.montoTotal,
          })),
        },
      },
      include: { lineas: true },
    });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = params.busqueda
      ? {
          OR: [
            { ncf: { contains: params.busqueda, mode: 'insensitive' as const } },
            { notas: { contains: params.busqueda, mode: 'insensitive' as const } },
          ],
        }
      : {};
    return Promise.all([
      this.db.gastoMenor.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { cuentaBancaria: true },
      }),
      this.db.gastoMenor.count({ where }),
    ]);
  }

  buscarPorId(id: string) {
    return this.db.gastoMenor.findUniqueOrThrow({
      where: { id },
      include: { lineas: { include: { cuentaContable: true } }, cuentaBancaria: true },
    });
  }
}
