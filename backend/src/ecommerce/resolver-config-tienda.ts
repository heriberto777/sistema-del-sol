import { PrismaService } from '../prisma/prisma.service';

export const CLAVE_TIENDA_ACTIVA = 'TIENDA_ACTIVA';
export const CLAVE_TIENDA_NOMBRE = 'TIENDA_NOMBRE';
export const CLAVE_TIENDA_PLANTILLA = 'TIENDA_PLANTILLA';
export const CLAVE_TIENDA_LOGO = 'TIENDA_LOGO';
export const CLAVE_TIENDA_BANNER = 'TIENDA_BANNER';
export const CLAVE_TIENDA_COLOR_ACENTO = 'TIENDA_COLOR_ACENTO';
export const CLAVE_TIENDA_BODEGA_ID = 'TIENDA_BODEGA_ID';
export const CLAVE_TIENDA_TEMA = 'TIENDA_TEMA';
export const CLAVE_TIENDA_BANNER_TEXTO = 'TIENDA_BANNER_TEXTO';

export const PLANTILLAS_TIENDA = [
  'DIRECTO',
  'MERCADO',
  'BOUTIQUE',
  'BRUMA',
  'BLOQUE',
  'NODO',
  'CHISPA',
  'EDITORIAL',
  'BASE',
  'ROPERO',
  'AMPLIA',
  'DISTRITO',
  'ATELIER',
  'OFICIO',
  'BAZAR',
  'VITRINA',
  'SOLMARKET',
] as const;
export type PlantillaTienda = (typeof PLANTILLAS_TIENDA)[number];

const CLAVES_TIENDA = [
  CLAVE_TIENDA_ACTIVA,
  CLAVE_TIENDA_NOMBRE,
  CLAVE_TIENDA_PLANTILLA,
  CLAVE_TIENDA_LOGO,
  CLAVE_TIENDA_BANNER,
  CLAVE_TIENDA_COLOR_ACENTO,
  CLAVE_TIENDA_BODEGA_ID,
  CLAVE_TIENDA_TEMA,
  CLAVE_TIENDA_BANNER_TEXTO,
];

export interface ConfigTienda {
  activa: boolean;
  nombre?: string;
  plantilla: PlantillaTienda;
  logo?: string;
  banner?: string;
  colorAcento?: string;
  bodegaId?: string;
  tema: TemaTienda;
  /** Fase 11 — mensaje de texto libre, editable por el admin, para la barra de anuncio arriba del Nav en las 14 plantillas (distinto de TIENDA_BANNER, que es una imagen usada solo por la plantilla "mercado"). */
  bannerTexto?: string;
}

// Catálogo curado — evita que el tenant elija una fuente exótica que
// rompa el layout de alguna plantilla. Incluye las fuentes ya usadas
// como default de cada plantilla nueva (Bruma/Bloque) además de las
// que se ofrecen para elegir libremente.
export const FUENTES_TIENDA = [
  'Fraunces',
  'Playfair Display',
  'Instrument Serif',
  'Cormorant',
  'Bodoni Moda',
  'Anton',
  'Oswald',
  'Unbounded',
  'DM Sans',
  'Manrope',
  'Lora',
  'Schibsted Grotesk',
  'Nunito Sans',
  'Barlow Condensed',
  'Outfit',
  'Poppins',
  'Sora',
  'Work Sans',
] as const;
export type FuenteTienda = (typeof FUENTES_TIENDA)[number];

export const TAMANOS_FUENTE_TIENDA = ['CHICO', 'MEDIANO', 'GRANDE'] as const;
export type TamanoFuenteTienda = (typeof TAMANOS_FUENTE_TIENDA)[number];

export const RADIOS_TARJETA_TIENDA = ['RECTA', 'SUAVE', 'REDONDEADA'] as const;
export type RadioTarjetaTienda = (typeof RADIOS_TARJETA_TIENDA)[number];

export const PROPORCIONES_IMAGEN_TIENDA = ['CUADRADA', 'VERTICAL', 'PANORAMICA'] as const;
export type ProporcionImagenTienda = (typeof PROPORCIONES_IMAGEN_TIENDA)[number];

/**
 * Fase 13 — cómo se muestra en la tarjeta de producto una oferta
 * PORCENTAJE/MONTO_FIJO o BOGO vigente para ese producto (estilo Amazon:
 * insignia + precio, no una sección "Ofertas" aparte). `CLASICO` = insignia
 * sólida + precio tachado + "Ahorrás X"; `AHORRO` = insignia neutra
 * "Oferta" + el número fuerte es el ahorro; `CINTA` = insignia tipo cinta
 * en el borde, sin línea de ahorro (más discreta).
 */
export const ESTILOS_INSIGNIA_OFERTA_TIENDA = ['CLASICO', 'AHORRO', 'CINTA'] as const;
export type EstiloInsigniaOfertaTienda = (typeof ESTILOS_INSIGNIA_OFERTA_TIENDA)[number];

export const CLAVES_MENU_TIENDA = ['inicio', 'categorias', 'carrito', 'cuenta'] as const;
export type ClaveMenuTienda = (typeof CLAVES_MENU_TIENDA)[number];

export interface ItemMenuTienda {
  clave: ClaveMenuTienda;
  visible: boolean;
}

export interface TemaTienda {
  /** null si el tenant nunca lo configuró (ni acá ni en el legacy `TIENDA_COLOR_ACENTO`) — cada plantilla nueva cae a su propio acento por defecto, igual criterio que ya usan Directo/Mercado/Boutique con su `ACCENT_DEFAULT`. */
  colorAcento: string | null;
  colorFondo: string | null;
  colorSuperficie: string | null;
  colorTexto: string | null;
  fuenteDisplay: FuenteTienda | null;
  fuenteBody: FuenteTienda | null;
  tamanoFuente: TamanoFuenteTienda;
  radioTarjeta: RadioTarjetaTienda;
  sombraTarjeta: boolean;
  proporcionImagen: ProporcionImagenTienda;
  menu: ItemMenuTienda[];
  /** Fase 13 — default CLASICO si el tenant nunca lo configuró. */
  estiloInsigniaOferta: EstiloInsigniaOfertaTienda;
  /** Fase 16 — sección "Ofertas" informativa del Home (chips agregados, alcance CARRITO incluido) — default `true`. Independiente de la insignia por producto (Fase 13), que sigue mostrándose siempre que haya oferta vigente. */
  mostrarSeccionOfertas: boolean;
}

const MENU_DEFAULT: ItemMenuTienda[] = CLAVES_MENU_TIENDA.map((clave) => ({ clave, visible: true }));

/**
 * Parsea `TIENDA_TEMA` (JSON serializado en una única clave de
 * `Configuracion` — única excepción al patrón de escalares sueltos de este
 * módulo, justificada porque el tema es un objeto cohesivo, no ajustes
 * independientes) de forma defensiva: cada campo se valida por separado
 * contra su unión de valores válidos y cae a su default si falta o el JSON
 * es inválido — nunca todo-o-nada, mismo criterio que ya usa `plantilla`
 * (cae a `'DIRECTO'` si el valor guardado no es válido).
 */
export function resolverTemaTienda(valorJson: string | undefined, colorAcentoLegacy: string | undefined): TemaTienda {
  let bruto: Partial<Record<keyof TemaTienda, unknown>> = {};
  if (valorJson) {
    try {
      const parseado = JSON.parse(valorJson);
      if (parseado && typeof parseado === 'object') bruto = parseado;
    } catch {
      bruto = {};
    }
  }

  const fuenteValida = (v: unknown): FuenteTienda | null =>
    typeof v === 'string' && (FUENTES_TIENDA as readonly string[]).includes(v) ? (v as FuenteTienda) : null;
  const colorValido = (v: unknown): string | null => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null);
  const menuValido = (v: unknown): ItemMenuTienda[] => {
    if (!Array.isArray(v)) return MENU_DEFAULT;
    const items = v.filter(
      (it): it is ItemMenuTienda =>
        it && typeof it === 'object' && (CLAVES_MENU_TIENDA as readonly string[]).includes(it.clave) && typeof it.visible === 'boolean',
    );
    const claves = new Set(items.map((it) => it.clave));
    if (claves.size !== CLAVES_MENU_TIENDA.length) return MENU_DEFAULT;
    return items;
  };

  return {
    colorAcento: colorValido(bruto.colorAcento) ?? colorValido(colorAcentoLegacy) ?? null,
    colorFondo: colorValido(bruto.colorFondo),
    colorSuperficie: colorValido(bruto.colorSuperficie),
    colorTexto: colorValido(bruto.colorTexto),
    fuenteDisplay: fuenteValida(bruto.fuenteDisplay),
    fuenteBody: fuenteValida(bruto.fuenteBody),
    tamanoFuente: (TAMANOS_FUENTE_TIENDA as readonly string[]).includes(bruto.tamanoFuente as string)
      ? (bruto.tamanoFuente as TamanoFuenteTienda)
      : 'MEDIANO',
    radioTarjeta: (RADIOS_TARJETA_TIENDA as readonly string[]).includes(bruto.radioTarjeta as string)
      ? (bruto.radioTarjeta as RadioTarjetaTienda)
      : 'SUAVE',
    sombraTarjeta: typeof bruto.sombraTarjeta === 'boolean' ? bruto.sombraTarjeta : true,
    proporcionImagen: (PROPORCIONES_IMAGEN_TIENDA as readonly string[]).includes(bruto.proporcionImagen as string)
      ? (bruto.proporcionImagen as ProporcionImagenTienda)
      : 'CUADRADA',
    menu: menuValido(bruto.menu),
    estiloInsigniaOferta: (ESTILOS_INSIGNIA_OFERTA_TIENDA as readonly string[]).includes(bruto.estiloInsigniaOferta as string)
      ? (bruto.estiloInsigniaOferta as EstiloInsigniaOfertaTienda)
      : 'CLASICO',
    mostrarSeccionOfertas: typeof bruto.mostrarSeccionOfertas === 'boolean' ? bruto.mostrarSeccionOfertas : true,
  };
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
    tema: resolverTemaTienda(valor(CLAVE_TIENDA_TEMA), valor(CLAVE_TIENDA_COLOR_ACENTO)),
    bannerTexto: valor(CLAVE_TIENDA_BANNER_TEXTO),
  };
}
