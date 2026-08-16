import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { CuentaBase } from './cuentas-base';

@Injectable()
export class CuentasContablesRepository {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listar() {
    return this.db.cuentaContable.findMany({ where: { activa: true }, orderBy: { codigo: 'asc' } });
  }

  buscarPorCodigo(codigo: string) {
    return this.db.cuentaContable.findFirstOrThrow({ where: { codigo } });
  }

  buscarPorId(id: string) {
    return this.db.cuentaContable.findUniqueOrThrow({ where: { id } });
  }

  crear(params: { tenantId: string; codigo: string; nombre: string; tipo: CuentaBase['tipo']; naturaleza: CuentaBase['naturaleza']; cuentaPadreId?: string }) {
    return this.db.cuentaContable.create({ data: params });
  }

  /** Usado por ContabilidadEventosService, fuera del contexto de un request HTTP (ver WebhooksRepository para el mismo patrón). */
  buscarPorCodigoGlobal(tenantId: string, codigo: string) {
    return this.prisma.cuentaContable.findFirstOrThrow({ where: { tenantId, codigo } });
  }
}
