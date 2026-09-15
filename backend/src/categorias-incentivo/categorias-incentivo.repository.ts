import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearCategoriaIncentivoDto } from './dto/crear-categoria-incentivo.dto';
import { ActualizarCategoriaIncentivoDto } from './dto/actualizar-categoria-incentivo.dto';

@Injectable()
export class CategoriasIncentivoRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearCategoriaIncentivoDto, tenantId: string) {
    return this.db.categoriaIncentivo.create({ data: { ...dto, tenantId } });
  }

  listar() {
    return this.db.categoriaIncentivo.findMany({ orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
  }

  actualizar(id: string, dto: ActualizarCategoriaIncentivoDto) {
    return this.db.categoriaIncentivo.update({ where: { id }, data: dto });
  }

  eliminar(id: string) {
    return this.db.categoriaIncentivo.delete({ where: { id } });
  }

  /** Para el selector de "Enviar reporte" — cualquier usuario activo del tenant, no solo Admin Total (el reporte de incentivo lo puede recibir cualquier encargado). */
  listarDestinatarios() {
    return this.db.user.findMany({ where: { activo: true }, select: { id: true, nombre: true, email: true }, orderBy: { nombre: 'asc' } });
  }

  /**
   * Cuenta totales/completadas por renglón activo dentro de [desde, hasta]
   * — filtra por `TareaPersonal.fecha` (día asignado), no por
   * `completadaEn`, para que una tarea completada tarde pero asignada al
   * período siga contando dentro de ese período. Pocas categorías en la
   * práctica, así que N+1 acá es más simple que un groupBy y no vale la
   * pena optimizar todavía.
   */
  async resumenPeriodo(desde: Date, hasta: Date) {
    const categorias = await this.db.categoriaIncentivo.findMany({ where: { activa: true }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });

    return Promise.all(
      categorias.map(async (categoria) => {
        const [tareasTotales, tareasCompletadas] = await Promise.all([
          this.db.tareaPersonal.count({ where: { categoriaIncentivoId: categoria.id, fecha: { gte: desde, lte: hasta } } }),
          this.db.tareaPersonal.count({ where: { categoriaIncentivoId: categoria.id, fecha: { gte: desde, lte: hasta }, estado: 'HECHA' } }),
        ]);
        return { categoria, tareasTotales, tareasCompletadas };
      }),
    );
  }
}
