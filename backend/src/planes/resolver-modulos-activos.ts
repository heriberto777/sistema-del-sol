import { PrismaService } from '../prisma/prisma.service';

/**
 * Única regla de resolución de "¿qué módulos tiene activos este tenant?":
 * una excepción (TenantModuloOverride) manda sobre lo que diga el Plan,
 * en cualquier dirección (forzar encendido o forzar apagado). La usan
 * `ModuloActivoGuard` (una clave puntual, por request) y
 * `AuthService.login` (la lista completa, para el frontend) — centralizada
 * acá para que nunca puedan divergir entre sí.
 */
export async function resolverModulosActivos(prisma: PrismaService, tenantId: string): Promise<string[]> {
  const [tenant, overrides] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: { include: { modulos: { include: { modulo: true } } } } },
    }),
    prisma.tenantModuloOverride.findMany({ where: { tenantId }, include: { modulo: true } }),
  ]);

  const activos = new Set(tenant?.plan?.modulos.map((pm) => pm.modulo.clave) ?? []);
  for (const override of overrides) {
    if (override.activo) activos.add(override.modulo.clave);
    else activos.delete(override.modulo.clave);
  }
  return Array.from(activos);
}

export async function moduloEstaActivo(prisma: PrismaService, tenantId: string, clave: string): Promise<boolean> {
  const override = await prisma.tenantModuloOverride.findFirst({ where: { tenantId, modulo: { clave } } });
  if (override) return override.activo;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: { include: { modulos: { include: { modulo: true } } } } },
  });
  return tenant?.plan?.modulos.some((pm) => pm.modulo.clave === clave) ?? false;
}

export interface ModuloConOrigen {
  clave: string;
  nombre: string;
  activo: boolean;
  origen: 'plan' | 'override';
}

/** Igual que resolverModulosActivos, pero para el checklist de plataforma: incluye TODO el catálogo (no solo los activos) y de dónde viene cada estado. */
export async function resolverModulosConOrigen(prisma: PrismaService, tenantId: string): Promise<ModuloConOrigen[]> {
  const [catalogo, tenant, overrides] = await Promise.all([
    prisma.modulo.findMany({ orderBy: { nombre: 'asc' } }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: { include: { modulos: { include: { modulo: true } } } } },
    }),
    prisma.tenantModuloOverride.findMany({ where: { tenantId }, include: { modulo: true } }),
  ]);

  const delPlan = new Set(tenant?.plan?.modulos.map((pm) => pm.modulo.clave) ?? []);
  const overridesPorClave = new Map(overrides.map((o) => [o.modulo.clave, o.activo]));

  return catalogo.map((modulo) => {
    const override = overridesPorClave.get(modulo.clave);
    if (override !== undefined) {
      return { clave: modulo.clave, nombre: modulo.nombre, activo: override, origen: 'override' as const };
    }
    return { clave: modulo.clave, nombre: modulo.nombre, activo: delPlan.has(modulo.clave), origen: 'plan' as const };
  });
}
