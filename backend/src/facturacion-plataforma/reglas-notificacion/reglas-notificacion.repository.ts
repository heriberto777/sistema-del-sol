import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CanalNotificacionVencimiento } from '@prisma/client';

/** Sin tenantId — reglas globales de plataforma, mismo criterio que PlataformaConfiguracion (fila/catálogo único, no por tenant). */
@Injectable()
export class ReglasNotificacionRepository {
  constructor(private readonly prisma: PrismaService) {}

  crear(params: { offsetDias: number; canal: CanalNotificacionVencimiento; activa?: boolean }) {
    return this.prisma.reglaNotificacionVencimiento.create({ data: params });
  }

  listar() {
    return this.prisma.reglaNotificacionVencimiento.findMany({ orderBy: { offsetDias: 'asc' } });
  }

  actualizarActiva(id: string, activa: boolean) {
    return this.prisma.reglaNotificacionVencimiento.update({ where: { id }, data: { activa } });
  }

  eliminar(id: string) {
    return this.prisma.reglaNotificacionVencimiento.delete({ where: { id } });
  }

  listarActivas() {
    return this.prisma.reglaNotificacionVencimiento.findMany({ where: { activa: true } });
  }

  yaFueEnviada(facturaPlataformaId: string, reglaId: string) {
    return this.prisma.notificacionVencimientoEnviada.findUnique({
      where: { facturaPlataformaId_reglaId: { facturaPlataformaId, reglaId } },
    });
  }

  registrarEnviada(facturaPlataformaId: string, reglaId: string) {
    return this.prisma.notificacionVencimientoEnviada.create({ data: { facturaPlataformaId, reglaId } });
  }
}
