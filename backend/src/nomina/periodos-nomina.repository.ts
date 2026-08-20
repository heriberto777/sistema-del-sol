import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EstadoPeriodoNomina, TipoPeriodoNomina } from '@prisma/client';

interface ReciboCalculado {
  empleadoId: string;
  salarioBruto: number;
  sfsEmpleado: number;
  afpEmpleado: number;
  isr: number;
  otrasDeducciones: number;
  descuentoAusencias: number;
  salarioNeto: number;
  sfsEmpleador: number;
  afpEmpleador: number;
  infotep: number;
}

const INCLUDE_PERIODO = { recibos: { include: { empleado: true } } } as const;

@Injectable()
export class PeriodosNominaRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(params: { tenantId: string; tipo: TipoPeriodoNomina; fechaInicio: Date; fechaFin: Date; recibos: ReciboCalculado[] }) {
    return this.db.periodoNomina.create({
      data: {
        tenantId: params.tenantId,
        tipo: params.tipo,
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
        recibos: { create: params.recibos },
      },
      include: INCLUDE_PERIODO,
    });
  }

  buscarPorId(id: string) {
    return this.db.periodoNomina.findUniqueOrThrow({ where: { id }, include: INCLUDE_PERIODO });
  }

  listar(params: { skip: number; take: number; estado?: EstadoPeriodoNomina }) {
    const where = params.estado ? { estado: params.estado } : {};
    return Promise.all([
      this.db.periodoNomina.findMany({ where, orderBy: { fechaInicio: 'desc' }, skip: params.skip, take: params.take }),
      this.db.periodoNomina.count({ where }),
    ]);
  }

  actualizarEstado(id: string, estado: EstadoPeriodoNomina, fechaPago?: Date) {
    return this.db.periodoNomina.update({ where: { id }, data: { estado, fechaPago }, include: INCLUDE_PERIODO });
  }
}
