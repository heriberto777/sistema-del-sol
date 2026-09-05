import { Injectable } from '@nestjs/common';
import { TipoCupon } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const INCLUDE_APLICACION = { cupon: true } as const;

@Injectable()
export class CuponesPlataformaRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.cuponDescuento.findMany({ orderBy: { createdAt: 'desc' } });
  }

  buscarPorCodigo(codigo: string) {
    return this.prisma.cuponDescuento.findUnique({ where: { codigo } });
  }

  crear(data: { codigo: string; tipo: TipoCupon; valor: number; duracionCiclos?: number | null; fechaExpiracion?: Date | null; usosMaximos?: number | null }) {
    return this.prisma.cuponDescuento.create({ data });
  }

  actualizar(id: string, data: { fechaExpiracion?: Date | null; usosMaximos?: number | null; activo?: boolean }) {
    return this.prisma.cuponDescuento.update({ where: { id }, data });
  }

  incrementarUso(id: string) {
    return this.prisma.cuponDescuento.update({ where: { id }, data: { usosActuales: { increment: 1 } } });
  }

  /** A lo sumo una aplicación activa por suscripción — la desactiva antes de crear una nueva (aplicar un cupón nuevo reemplaza al anterior, no los apila). */
  desactivarAplicacionesActivas(suscripcionId: string) {
    return this.prisma.suscripcionCupon.updateMany({ where: { suscripcionId, activo: true }, data: { activo: false } });
  }

  crearAplicacion(data: { suscripcionId: string; cuponId: string; ciclosRestantes: number | null }) {
    return this.prisma.suscripcionCupon.create({ data, include: INCLUDE_APLICACION });
  }

  buscarAplicacionActiva(suscripcionId: string) {
    return this.prisma.suscripcionCupon.findFirst({ where: { suscripcionId, activo: true }, include: INCLUDE_APLICACION });
  }

  /** `ciclosRestantes: null` = indefinido, nunca llega acá (se filtra antes de llamar). */
  decrementarCiclos(id: string, ciclosRestantes: number) {
    return this.prisma.suscripcionCupon.update({ where: { id }, data: { ciclosRestantes } });
  }

  desactivarAplicacion(id: string) {
    return this.prisma.suscripcionCupon.update({ where: { id }, data: { activo: false } });
  }
}
