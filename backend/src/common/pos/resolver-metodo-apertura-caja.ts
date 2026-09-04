import { MetodoAperturaCaja } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CONFIGURACIONES_BASE } from '../../tenants/roles-base';

export const CLAVE_CAJA_METODO_APERTURA_DEFAULT = 'CAJA_METODO_APERTURA_DEFAULT';

const VALORES_METODO_APERTURA_CAJA = new Set<string>(Object.values(MetodoAperturaCaja));

/**
 * Mismo patrón exacto que resolverFormatoImpresion: un override puntual
 * (acá, de Bodega) manda sobre el default de tenant (Configuracion).
 * bodegaId ya viene de un TurnoCaja propio del tenant (buscarPorId ya lo
 * aisló), pero se filtra también por tenantId acá por defensa.
 */
export async function resolverMetodoAperturaCaja(
  prisma: PrismaService,
  tenantId: string,
  bodegaId?: string | null,
): Promise<MetodoAperturaCaja> {
  const [bodega, config] = await Promise.all([
    bodegaId ? prisma.bodega.findFirst({ where: { id: bodegaId, tenantId }, select: { metodoAperturaCaja: true } }) : null,
    prisma.configuracion.findUnique({ where: { tenantId_clave: { tenantId, clave: CLAVE_CAJA_METODO_APERTURA_DEFAULT } } }),
  ]);

  if (bodega?.metodoAperturaCaja) return bodega.metodoAperturaCaja;
  if (config?.valor && VALORES_METODO_APERTURA_CAJA.has(config.valor)) return config.valor as MetodoAperturaCaja;
  return CONFIGURACIONES_BASE.CAJA_METODO_APERTURA_DEFAULT as MetodoAperturaCaja;
}
