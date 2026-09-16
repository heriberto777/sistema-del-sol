import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ContextoNegocio } from './sugerir-comportamiento.prompt';

@Injectable()
export class WhatsappConfigRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /**
   * `upsert` (no "buscar y si no existe, crear") a propósito — ese patrón
   * tiene una ventana de carrera real: dos requests casi simultáneos para
   * un tenant que todavía no tiene fila (dos pestañas, un reintento de
   * red, StrictMode en dev) pueden ver "no existe" los dos y disparar dos
   * `create()` — el índice único de `tenantId` evita el duplicado real,
   * pero el segundo `create()` revienta con un 500 sin manejar en vez de
   * devolver la fila que el primero ya creó. `upsert` es atómico del lado
   * de Postgres, sin esa ventana.
   */
  async obtenerOCrear(tenantId: string) {
    return this.db.whatsappConfigTenant.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }

  async actualizar(id: string, data: Prisma.WhatsappConfigTenantUpdateInput) {
    return this.db.whatsappConfigTenant.update({ where: { id }, data });
  }

  /**
   * Datos reales del negocio para armar la sugerencia de "Información del
   * negocio" (ver WhatsappConfigService.sugerirComportamiento) — `Tenant`
   * no es tenant-scoped (es la tabla raíz), se filtra por `id` directo,
   * mismo criterio que TenantEmpresaRepository.
   */
  async obtenerContextoNegocio(tenantId: string): Promise<ContextoNegocio> {
    const [tenant, categorias, productos] = await Promise.all([
      this.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { nombre: true, direccion: true } }),
      this.db.categoria.findMany({ where: { activa: true }, select: { nombre: true }, take: 12 }),
      this.db.producto.findMany({ where: { activo: true }, select: { nombre: true }, take: 12, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      nombre: tenant.nombre,
      direccion: tenant.direccion,
      categorias: categorias.map((c) => c.nombre),
      productos: productos.map((p) => p.nombre),
    };
  }
}
