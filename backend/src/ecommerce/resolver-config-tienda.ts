import { PrismaService } from '../prisma/prisma.service';

export const CLAVE_TIENDA_ACTIVA = 'TIENDA_ACTIVA';
export const CLAVE_TIENDA_NOMBRE = 'TIENDA_NOMBRE';
export const CLAVE_TIENDA_PLANTILLA = 'TIENDA_PLANTILLA';
export const CLAVE_TIENDA_LOGO = 'TIENDA_LOGO';
export const CLAVE_TIENDA_BANNER = 'TIENDA_BANNER';
export const CLAVE_TIENDA_COLOR_ACENTO = 'TIENDA_COLOR_ACENTO';
export const CLAVE_TIENDA_BODEGA_ID = 'TIENDA_BODEGA_ID';

export const PLANTILLAS_TIENDA = ['DIRECTO', 'MERCADO', 'BOUTIQUE'] as const;
export type PlantillaTienda = (typeof PLANTILLAS_TIENDA)[number];

const CLAVES_TIENDA = [
  CLAVE_TIENDA_ACTIVA,
  CLAVE_TIENDA_NOMBRE,
  CLAVE_TIENDA_PLANTILLA,
  CLAVE_TIENDA_LOGO,
  CLAVE_TIENDA_BANNER,
  CLAVE_TIENDA_COLOR_ACENTO,
  CLAVE_TIENDA_BODEGA_ID,
];

export interface ConfigTienda {
  activa: boolean;
  nombre?: string;
  plantilla: PlantillaTienda;
  logo?: string;
  banner?: string;
  colorAcento?: string;
  bodegaId?: string;
}

/**
 * Configuración de la Tienda Online (plugin e-commerce v1) — mismo patrón
 * que `resolverPersonalizacionDocumento`: claves sueltas en el store
 * genérico `Configuracion`, sin modelo Prisma propio. Se escriben desde el
 * frontend con el endpoint YA existente `PUT /admin/configuraciones/:clave`
 * (`ConfiguracionesController`) — no hay endpoint de escritura dedicado acá.
 */
export async function resolverConfigTienda(prisma: PrismaService, tenantId: string): Promise<ConfigTienda> {
  const filas = await prisma.configuracion.findMany({
    where: { tenantId, clave: { in: CLAVES_TIENDA } },
  });
  const valor = (clave: string) => filas.find((f) => f.clave === clave)?.valor || undefined;

  const plantilla = valor(CLAVE_TIENDA_PLANTILLA);
  return {
    activa: valor(CLAVE_TIENDA_ACTIVA) === 'true',
    nombre: valor(CLAVE_TIENDA_NOMBRE),
    plantilla: (PLANTILLAS_TIENDA as readonly string[]).includes(plantilla ?? '') ? (plantilla as PlantillaTienda) : 'DIRECTO',
    logo: valor(CLAVE_TIENDA_LOGO),
    banner: valor(CLAVE_TIENDA_BANNER),
    colorAcento: valor(CLAVE_TIENDA_COLOR_ACENTO),
    bodegaId: valor(CLAVE_TIENDA_BODEGA_ID),
  };
}
