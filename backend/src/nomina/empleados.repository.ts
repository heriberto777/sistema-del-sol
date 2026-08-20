import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TipoContrato } from '@prisma/client';

@Injectable()
export class EmpleadosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(params: {
    tenantId: string;
    nombre: string;
    cedula: string;
    cargo: string;
    departamento?: string;
    fechaIngreso: Date;
    salarioBrutoMensual: number;
    tipoContrato?: TipoContrato;
    email?: string;
    telefono?: string;
  }) {
    return this.db.empleado.create({ data: params });
  }

  buscarPorId(id: string) {
    return this.db.empleado.findUniqueOrThrow({ where: { id } });
  }

  /** Resuelve "quién soy" para el check-in/check-out de autoservicio (Asistencia) desde req.user.userId. */
  buscarPorUserId(userId: string) {
    return this.db.empleado.findUnique({ where: { userId } });
  }

  listarActivos() {
    return this.db.empleado.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  }

  /**
   * "Vendedor" acá es `Empleado.cargo` (texto libre de Nómina) — no el rol
   * de sistema homónimo (`ROLES_BASE`, ligado a `User`). Son dos conceptos
   * sin relación: un vendedor de comisión no necesita poder loguearse.
   */
  listarVendedores(busqueda?: string) {
    return this.db.empleado.findMany({
      where: {
        activo: true,
        cargo: { contains: 'Vendedor', mode: 'insensitive' },
        ...(busqueda ? { nombre: { contains: busqueda, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { nombre: 'asc' },
      take: 20,
    });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = params.busqueda
      ? {
          OR: [
            { nombre: { contains: params.busqueda, mode: 'insensitive' as const } },
            { cedula: { contains: params.busqueda, mode: 'insensitive' as const } },
            { cargo: { contains: params.busqueda, mode: 'insensitive' as const } },
          ],
        }
      : {};
    return Promise.all([
      this.db.empleado.findMany({ where, orderBy: { nombre: 'asc' }, skip: params.skip, take: params.take }),
      this.db.empleado.count({ where }),
    ]);
  }

  actualizar(
    id: string,
    data: Partial<{
      nombre: string;
      cedula: string;
      cargo: string;
      departamento: string;
      fechaIngreso: Date;
      salarioBrutoMensual: number;
      tipoContrato: TipoContrato;
      email: string;
      telefono: string;
      activo: boolean;
      fechaSalida: Date;
      userId: string | null;
    }>,
  ) {
    return this.db.empleado.update({ where: { id }, data });
  }
}
