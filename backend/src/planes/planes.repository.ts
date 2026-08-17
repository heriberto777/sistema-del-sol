import { Injectable } from '@nestjs/common';
import { CicloFacturacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const INCLUDE_PLAN = { modulos: { include: { modulo: true } } } as const;

@Injectable()
export class PlanesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.plan.findMany({ include: INCLUDE_PLAN, orderBy: { nombre: 'asc' } });
  }

  buscarPorId(id: string) {
    return this.prisma.plan.findUniqueOrThrow({ where: { id }, include: INCLUDE_PLAN });
  }

  listarModulos() {
    return this.prisma.modulo.findMany({ orderBy: { nombre: 'asc' } });
  }

  async crear(params: {
    nombre: string;
    descripcion?: string;
    precio?: number;
    cicloFacturacion?: CicloFacturacion;
    modulos: string[];
  }) {
    const modulosDb = await this.prisma.modulo.findMany({ where: { clave: { in: params.modulos } } });
    return this.prisma.plan.create({
      data: {
        nombre: params.nombre,
        descripcion: params.descripcion,
        precio: params.precio,
        cicloFacturacion: params.cicloFacturacion,
        modulos: { create: modulosDb.map((m) => ({ moduloId: m.id })) },
      },
      include: INCLUDE_PLAN,
    });
  }

  async actualizar(
    id: string,
    params: { nombre?: string; descripcion?: string; precio?: number; cicloFacturacion?: CicloFacturacion; modulos?: string[] },
  ) {
    if (params.modulos) {
      const modulosDb = await this.prisma.modulo.findMany({ where: { clave: { in: params.modulos } } });
      await this.prisma.planModulo.deleteMany({ where: { planId: id } });
      await this.prisma.planModulo.createMany({ data: modulosDb.map((m) => ({ planId: id, moduloId: m.id })) });
    }
    return this.prisma.plan.update({
      where: { id },
      data: {
        nombre: params.nombre,
        descripcion: params.descripcion,
        precio: params.precio,
        cicloFacturacion: params.cicloFacturacion,
      },
      include: INCLUDE_PLAN,
    });
  }
}
