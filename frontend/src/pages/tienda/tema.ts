import { CSSProperties, useEffect } from 'react';

// Espejo manual de `backend/src/ecommerce/resolver-config-tienda.ts` — mismo
// criterio ya usado para `PlantillaTienda`/`PLANTILLAS_TIENDA` en este repo
// (frontend y backend son paquetes separados, sin tipos compartidos).
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

export const CLAVES_MENU_TIENDA = ['inicio', 'categorias', 'carrito', 'cuenta'] as const;
export type ClaveMenuTienda = (typeof CLAVES_MENU_TIENDA)[number];

export interface ItemMenuTienda {
  clave: ClaveMenuTienda;
  visible: boolean;
}

export interface TemaTienda {
  /** null si el tenant nunca lo configuró — cada plantilla cae a su propio acento por defecto. */
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
}

export const MENU_DEFAULT: ItemMenuTienda[] = CLAVES_MENU_TIENDA.map((clave) => ({ clave, visible: true }));

export const TAMANO_FUENTE_PX: Record<TamanoFuenteTienda, string> = {
  CHICO: '14px',
  MEDIANO: '16px',
  GRANDE: '18px',
};

export const RADIO_TARJETA_PX: Record<RadioTarjetaTienda, string> = {
  RECTA: '4px',
  SUAVE: '10px',
  REDONDEADA: '20px',
};

export const PROPORCION_IMAGEN_CSS: Record<ProporcionImagenTienda, string> = {
  CUADRADA: '1/1',
  VERTICAL: '3/4',
  PANORAMICA: '4/3',
};

const SOMBRA_TARJETA = '0 10px 24px -16px rgba(0,0,0,.35)';

export interface DefaultsTemaPlantilla {
  colorAcento: string;
  colorFondo: string;
  colorSuperficie: string;
  colorTexto: string;
  fuenteDisplay: string;
  fuenteBody: string;
}

/**
 * Arma las variables CSS `--tienda-*` que consumen las plantillas nuevas
 * (Bruma/Bloque) — cada campo `null` de `tema` cae al default propio de la
 * plantilla (pasado por el llamador) para que se vea terminada sin que el
 * tenant tenga que tocar nada en Personalización.
 */
export function variablesCssTema(tema: TemaTienda, defaults: DefaultsTemaPlantilla): CSSProperties {
  return {
    '--tienda-color-acento': tema.colorAcento ?? defaults.colorAcento,
    '--tienda-color-fondo': tema.colorFondo ?? defaults.colorFondo,
    '--tienda-color-superficie': tema.colorSuperficie ?? defaults.colorSuperficie,
    '--tienda-color-texto': tema.colorTexto ?? defaults.colorTexto,
    '--tienda-fuente-display': `'${tema.fuenteDisplay ?? defaults.fuenteDisplay}', serif`,
    '--tienda-fuente-body': `'${tema.fuenteBody ?? defaults.fuenteBody}', sans-serif`,
    '--tienda-tamano-fuente': TAMANO_FUENTE_PX[tema.tamanoFuente],
    '--tienda-radio-tarjeta': RADIO_TARJETA_PX[tema.radioTarjeta],
    '--tienda-sombra-tarjeta': tema.sombraTarjeta ? SOMBRA_TARJETA : 'none',
    '--tienda-ratio-imagen': PROPORCION_IMAGEN_CSS[tema.proporcionImagen],
  } as CSSProperties;
}

/** Devuelve solo las claves visibles, en el orden guardado — Nav de cada plantilla mapea cada clave a su propio label/href. */
export function menuVisibleOrdenado(menu: ItemMenuTienda[]): ClaveMenuTienda[] {
  return menu.filter((it) => it.visible).map((it) => it.clave);
}

/**
 * Inyecta un único `<link>` de Google Fonts con solo las fuentes
 * efectivamente en uso (deduplicadas) — evita cargar el catálogo curado
 * completo (~18 familias) en cada visita pública.
 */
export function useCargarFuentesTienda(fuentes: (string | null | undefined)[]): void {
  const familias = Array.from(new Set(fuentes.filter((f): f is string => !!f)));
  const query = familias.join('&');

  useEffect(() => {
    if (familias.length === 0) return undefined;
    const href = `https://fonts.googleapis.com/css2?${familias
      .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
      .join('&')}&display=swap`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
}
