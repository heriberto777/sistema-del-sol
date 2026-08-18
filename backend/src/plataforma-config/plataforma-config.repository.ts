import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlataformaConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Fila única — la crea con defaults si todavía no existe ninguna. orderBy determinístico por si una carrera rarísima creara dos. */
  async obtenerOCrear() {
    const existente = await this.prisma.plataformaConfiguracion.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existente) return existente;
    return this.prisma.plataformaConfiguracion.create({ data: {} });
  }

  async actualizar(id: string, data: Prisma.PlataformaConfiguracionUpdateInput) {
    return this.prisma.plataformaConfiguracion.update({ where: { id }, data });
  }
}
