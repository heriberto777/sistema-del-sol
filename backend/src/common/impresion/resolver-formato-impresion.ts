import { FormatoImpresion } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CONFIGURACIONES_BASE } from '../../tenants/roles-base';

export const CLAVE_FORMATO_IMPRESION_DEFAULT = 'FORMATO_IMPRESION_DEFAULT';

const VALORES_FORMATO_IMPRESION = new Set<string>(Object.values(FormatoImpresion));

/**
 * Igual regla que resolverModulosActivos: un override puntual (acá, de
 * Bodega) manda sobre el default de tenant (Configuracion). bodegaId ya
 * viene de una Factura/Remisión propia del tenant (buscarPorId ya la
 * aisló), pero se filtra también por tenantId acá por defensa.
 */
export async function resolverFormatoImpresion(
  prisma: PrismaService,
  tenantId: string,
  bodegaId?: string | null,
): Promise<FormatoImpresion> {
  const [bodega, config] = await Promise.all([
    bodegaId ? prisma.bodega.findFirst({ where: { id: bodegaId, tenantId }, select: { formatoImpresion: true } }) : null,
    prisma.configuracion.findUnique({ where: { tenantId_clave: { tenantId, clave: CLAVE_FORMATO_IMPRESION_DEFAULT } } }),
  ]);

  if (bodega?.formatoImpresion) return bodega.formatoImpresion;
  if (config?.valor && VALORES_FORMATO_IMPRESION.has(config.valor)) return config.valor as FormatoImpresion;
  return CONFIGURACIONES_BASE.FORMATO_IMPRESION_DEFAULT as FormatoImpresion;
}
