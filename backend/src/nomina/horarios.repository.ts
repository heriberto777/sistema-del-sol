import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { DiaSemana } from '@prisma/client';

@Injectable()
export class HorariosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listarPorEmpleado(empleadoId: string) {
    return this.db.horarioEmpleado.findMany({ where: { empleadoId }, orderBy: { diaSemana: 'asc' } });
  }

  /** Borra las 7 filas posibles y crea las nuevas, en una sola transacción — mismo patrón que ComponenteCombo/líneas de recepción. */
  reemplazar(tenantId: string, empleadoId: string, dias: { diaSemana: DiaSemana; horaEntrada: string; horaSalida: string }[]) {
    return this.db.$transaction(async (tx) => {
      await tx.horarioEmpleado.deleteMany({ where: { empleadoId } });
      if (dias.length) {
        await tx.horarioEmpleado.createMany({
          data: dias.map((d) => ({ tenantId, empleadoId, diaSemana: d.diaSemana, horaEntrada: d.horaEntrada, horaSalida: d.horaSalida })),
        });
      }
      return tx.horarioEmpleado.findMany({ where: { empleadoId }, orderBy: { diaSemana: 'asc' } });
    });
  }
}
