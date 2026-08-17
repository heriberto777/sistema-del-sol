import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Nunca seleccionar passwordHash/resetPasswordTokenHash hacia afuera de este repositorio.
const SELECT_ADMIN = {
  id: true,
  email: true,
  nombre: true,
  activo: true,
  createdAt: true,
  roleId: true,
  role: true,
} as const;

@Injectable()
export class PlatformAdminsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.platformAdmin.findMany({ select: SELECT_ADMIN, orderBy: { createdAt: 'desc' } });
  }

  crear(params: { email: string; passwordHash: string; nombre: string; roleId?: string }) {
    return this.prisma.platformAdmin.create({
      data: { email: params.email, passwordHash: params.passwordHash, nombre: params.nombre, roleId: params.roleId },
      select: SELECT_ADMIN,
    });
  }

  actualizar(id: string, data: { nombre?: string; activo?: boolean; roleId?: string | null }) {
    return this.prisma.platformAdmin.update({ where: { id }, data, select: SELECT_ADMIN });
  }
}
