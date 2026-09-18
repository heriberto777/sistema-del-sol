import { PlantillaDocumento } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CONFIGURACIONES_BASE } from '../../tenants/roles-base';

export const CLAVE_PLANTILLA_DOCUMENTO_DEFAULT = 'PLANTILLA_DOCUMENTO_DEFAULT';

const VALORES_PLANTILLA_DOCUMENTO = new Set<string>(Object.values(PlantillaDocumento));

/**
 * Mismo criterio exacto que resolverFormatoImpresion — eje independiente
 * (diseño visual, no tamaño de papel): override de Bodega > default de
 * tenant (Configuracion) > CLASICO. No aplica a TERMICA_80MM/58MM, así
 * que quien llama a esto para un formato térmico simplemente no usa el
 * resultado (ver FacturacionService.generarImpreso).
 */
export async function resolverPlantillaDocumento(
  prisma: PrismaService,
  tenantId: string,
  bodegaId?: string | null,
): Promise<PlantillaDocumento> {
  const [bodega, config] = await Promise.all([
    bodegaId ? prisma.bodega.findFirst({ where: { id: bodegaId, tenantId }, select: { plantillaDocumento: true } }) : null,
    prisma.configuracion.findUnique({ where: { tenantId_clave: { tenantId, clave: CLAVE_PLANTILLA_DOCUMENTO_DEFAULT } } }),
  ]);

  if (bodega?.plantillaDocumento) return bodega.plantillaDocumento;
  if (config?.valor && VALORES_PLANTILLA_DOCUMENTO.has(config.valor)) return config.valor as PlantillaDocumento;
  return CONFIGURACIONES_BASE.PLANTILLA_DOCUMENTO_DEFAULT as PlantillaDocumento;
}
