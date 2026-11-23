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

  /** Sin filtrar por `activa` — para completarCatalogo(), que necesita saber qué códigos ya existen (el unique de (tenantId, codigo) no distingue activas de inactivas). */
  listarTodasLasCuentas() {
    return this.db.cuentaContable.findMany({ select: { id: true, codigo: true } });
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

  /**
   * Resuelve una cuenta por su ROL en el sistema (ej. "CAJA_BANCOS"), no
   * por su código fijo — docs/PLAN.md, punto 4. Si el tenant configuró un
   * override (`ConfiguracionCuentaContable`), usa esa cuenta; si no, cae
   * en el código fijo de siempre (retrocompatible). Usa `this.prisma`
   * (global) con `tenantId` explícito en toda la cadena, igual criterio
   * que `buscarPorCodigoGlobal` — así sirve tanto dentro de un request
   * HTTP como desde un listener de eventos (fuera de uno).
   */
  async resolverRolDeCuenta(tenantId: string, clave: string, codigoFijo: string) {
    const override = await this.prisma.configuracionCuentaContable.findUnique({ where: { tenantId_clave: { tenantId, clave } } });
    if (override) {
      return this.prisma.cuentaContable.findUniqueOrThrow({ where: { id: override.cuentaContableId } });
    }
    return this.buscarPorCodigoGlobal(tenantId, codigoFijo);
  }

  /** CRUD de la configuración (pantalla de administración) — tenant-scoped vía TenantPrismaService, siempre dentro de un request HTTP. */
  listarConfiguracionCuentasSistema(tenantId: string) {
    return this.db.configuracionCuentaContable.findMany({ where: { tenantId }, include: { cuentaContable: true } });
  }

  guardarConfiguracionCuentaSistema(tenantId: string, clave: string, cuentaContableId: string) {
    return this.db.configuracionCuentaContable.upsert({
      where: { tenantId_clave: { tenantId, clave } },
      create: { tenantId, clave, cuentaContableId },
      update: { cuentaContableId },
    });
  }

  eliminarConfiguracionCuentaSistema(tenantId: string, clave: string) {
    return this.db.configuracionCuentaContable.deleteMany({ where: { tenantId, clave } });
  }

  /**
   * Lectura cruzada a CuentaBancaria (dueña del módulo Bancos) para la
   * conciliación bancaria — mismo criterio pragmático que ya usa
   * GastosMenoresService para tocar CuentaBancaria sin importar el
   * módulo de Bancos completo. `this.db` ya inyecta tenantId (ambos
   * modelos están en TENANT_SCOPED_MODELS).
   */
  buscarCuentaBancariaConContable(id: string) {
    return this.db.cuentaBancaria.findUniqueOrThrow({ where: { id }, include: { cuentaContable: true } });
  }
}
