import { PrismaService } from '../../prisma/prisma.service';

export const CLAVE_DOCUMENTO_NOTA_PIE = 'DOCUMENTO_NOTA_PIE';

/**
 * Personalización de documentos imprimibles (plan de integración Cuadre,
 * ítem H-3, alcance reducido a propósito): logo + nota de pie, no un
 * editor de plantillas completo — `documento-pdf.ts`/`documento-ticket.ts`
 * siguen siendo generadores fijos en código, solo ganan estos dos huecos.
 *
 * `logo` sale de `Tenant.logo` (campo propio — antes vivía en
 * `Configuracion[DOCUMENTO_LOGO]`, promovido para que Plataforma también
 * pueda asignarlo/verlo desde `/plataforma/tenants` sin pasar por el RLS
 * tenant-scoped de `Configuracion`). `notaPie` sigue en `Configuracion`
 * sin cambios — mismo patrón de lectura directa que
 * `resolverFormatoImpresion` (Prisma global, sin inyectar
 * `ConfiguracionesService` en cada servicio de documento).
 */
export async function resolverPersonalizacionDocumento(
  prisma: PrismaService,
  tenantId: string,
): Promise<{ logo?: string; notaPie?: string }> {
  const [tenant, notaPieFila] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { logo: true } }),
    prisma.configuracion.findUnique({ where: { tenantId_clave: { tenantId, clave: CLAVE_DOCUMENTO_NOTA_PIE } } }),
  ]);
  return { logo: tenant?.logo || undefined, notaPie: notaPieFila?.valor || undefined };
}
