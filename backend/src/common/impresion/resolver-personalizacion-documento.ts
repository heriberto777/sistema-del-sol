import { PrismaService } from '../../prisma/prisma.service';
import { EmisorDocumentoPdf } from '../pdf/documento-pdf';

export const CLAVE_DOCUMENTO_NOTA_PIE = 'DOCUMENTO_NOTA_PIE';

/**
 * Personalización de documentos imprimibles (plan de integración Cuadre,
 * ítem H-3, alcance reducido a propósito): logo + nota de pie, no un
 * editor de plantillas completo — `documento-pdf.ts`/`documento-ticket.ts`
 * siguen siendo generadores fijos en código, solo ganan estos huecos.
 *
 * `logo` sale de `Tenant.logo` (campo propio — antes vivía en
 * `Configuracion[DOCUMENTO_LOGO]`, promovido para que Plataforma también
 * pueda asignarlo/verlo desde `/plataforma/tenants` sin pasar por el RLS
 * tenant-scoped de `Configuracion`). `notaPie` sigue en `Configuracion`
 * sin cambios — mismo patrón de lectura directa que
 * `resolverFormatoImpresion` (Prisma global, sin inyectar
 * `ConfiguracionesService` en cada servicio de documento).
 *
 * `emisor` (nombre/RNC/dirección/teléfono del propio `Tenant`) — antes
 * `DocumentoPdfParams.emisor` solo lo llenaba FacturaPlataforma; se
 * resuelve acá (misma query a `Tenant`, sin round-trip aparte) para que
 * las plantillas nuevas de Facturación/Cotizaciones/Remisiones (ver
 * documento-pdf.ts) puedan mostrar quién emite el documento, no solo el
 * cliente.
 */
export async function resolverPersonalizacionDocumento(
  prisma: PrismaService,
  tenantId: string,
): Promise<{ logo?: string; notaPie?: string; emisor?: EmisorDocumentoPdf }> {
  const [tenant, notaPieFila] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { logo: true, nombre: true, rnc: true, direccion: true, telefono: true } }),
    prisma.configuracion.findUnique({ where: { tenantId_clave: { tenantId, clave: CLAVE_DOCUMENTO_NOTA_PIE } } }),
  ]);
  return {
    logo: tenant?.logo || undefined,
    notaPie: notaPieFila?.valor || undefined,
    emisor: tenant ? { nombre: tenant.nombre, rnc: tenant.rnc || undefined, direccion: tenant.direccion || undefined, telefono: tenant.telefono || undefined } : undefined,
  };
}
