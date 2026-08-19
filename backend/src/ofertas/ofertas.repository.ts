import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearOfertaDto } from './dto/crear-oferta.dto';

@Injectable()
export class OfertasRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearOfertaDto, tenantId: string) {
    return this.db.oferta.create({ data: { ...dto, tenantId } });
  }

  listar() {
    return this.db.oferta.findMany({
      orderBy: { createdAt: 'desc' },
      include: { producto: { select: { id: true, codigo: true, nombre: true } }, categoria: { select: { id: true, nombre: true } } },
    });
  }

  buscarPorId(id: string) {
    return this.db.oferta.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearOfertaDto>) {
    return this.db.oferta.update({ where: { id }, data: dto });
  }

  eliminar(id: string) {
    return this.db.oferta.delete({ where: { id } });
  }

  /** Ofertas de PRODUCTO/CATEGORIA vigentes ahora mismo que matchean esa línea — ver OfertasService.resolverDescuentoLinea. */
  buscarVigentesParaLinea(productoId: string, categoriaId: string | null, ahora: Date) {
    return this.db.oferta.findMany({
      where: {
        activa: true,
        fechaInicio: { lte: ahora },
        fechaFin: { gte: ahora },
        OR: [{ alcance: 'PRODUCTO', productoId }, ...(categoriaId ? [{ alcance: 'CATEGORIA' as const, categoriaId }] : [])],
      },
    });
  }

  /** Ofertas de CARRITO vigentes ahora mismo — ver OfertasService.resolverDescuentoCarritoTotal. */
  buscarVigentesDeCarrito(ahora: Date) {
    return this.db.oferta.findMany({
      where: { activa: true, alcance: 'CARRITO', fechaInicio: { lte: ahora }, fechaFin: { gte: ahora } },
    });
  }
}
