import { PrismaService } from '../../prisma/prisma.service';

export const CLAVE_DOCUMENTO_LOGO = 'DOCUMENTO_LOGO';
export const CLAVE_DOCUMENTO_NOTA_PIE = 'DOCUMENTO_NOTA_PIE';

/**
 * Personalización de documentos imprimibles (plan de integración Cuadre,
 * ítem H-3, alcance reducido a propósito): logo + nota de pie, no un
 * editor de plantillas completo — `documento-pdf.ts`/`documento-ticket.ts`
 * siguen siendo generadores fijos en código, solo ganan estos dos huecos.
 * Mismo patrón de lectura directa que `resolverFormatoImpresion` (Prisma
 * global, sin inyectar ConfiguracionesService en cada servicio de
 * documento) — ninguna de las dos claves está en `CONFIGURACIONES_BASE`
 * porque no tienen un default útil (vacío = sin personalizar) y
 * `actualizar()` ya hace upsert, así que no hace falta sembrarlas.
 */
export async function resolverPersonalizacionDocumento(
  prisma: PrismaService,
  tenantId: string,
): Promise<{ logo?: string; notaPie?: string }> {
  const filas = await prisma.configuracion.findMany({
    where: { tenantId, clave: { in: [CLAVE_DOCUMENTO_LOGO, CLAVE_DOCUMENTO_NOTA_PIE] } },
  });
  const logo = filas.find((f) => f.clave === CLAVE_DOCUMENTO_LOGO)?.valor;
  const notaPie = filas.find((f) => f.clave === CLAVE_DOCUMENTO_NOTA_PIE)?.valor;
  return { logo: logo || undefined, notaPie: notaPie || undefined };
}
