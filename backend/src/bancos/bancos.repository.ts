import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearCuentaBancariaDto } from './dto/crear-cuenta-bancaria.dto';

@Injectable()
export class BancosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearCuentaBancariaDto, tenantId: string) {
    return this.db.cuentaBancaria.create({ data: { ...dto, tenantId } });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = {
      activa: true,
      ...(params.busqueda
        ? {
            OR: [
              { banco: { contains: params.busqueda, mode: 'insensitive' as const } },
              { numeroCuenta: { contains: params.busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.db.cuentaBancaria.findMany({ where, orderBy: { banco: 'asc' }, skip: params.skip, take: params.take, include: { cuentaContable: true } }),
      this.db.cuentaBancaria.count({ where }),
    ]);
  }

  buscarPorId(id: string) {
    return this.db.cuentaBancaria.findUniqueOrThrow({ where: { id }, include: { cuentaContable: true } });
  }

  actualizar(id: string, dto: Partial<CrearCuentaBancariaDto>) {
    return this.db.cuentaBancaria.update({ where: { id }, data: dto });
  }
}
