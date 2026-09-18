import { MENU_DEFAULT, TemaTienda } from '../../../pages/tienda/tema';
import { MensajeBannerAnuncio } from '../../../pages/tienda/BannerAnuncio';

// Parsing/lógica de negocio del formulario — antes vivía enterrada dentro
// de TiendaOnlineConfigPanel.tsx, mezclada con el render (auditoría de
// estructura del frontend).

export const TEMA_DEFAULT: TemaTienda = {
  colorAcento: null,
  colorFondo: null,
  colorSuperficie: null,
  colorTexto: null,
  fuenteDisplay: null,
  fuenteBody: null,
  tamanoFuente: 'MEDIANO',
  radioTarjeta: 'SUAVE',
  sombraTarjeta: true,
  proporcionImagen: 'CUADRADA',
  menu: MENU_DEFAULT,
  estiloInsigniaOferta: 'CLASICO',
  estiloInsigniaSinStock: 'ETIQUETA',
};

/**
 * Parseo defensivo espejo de `resolverTemaTienda` (backend) — acá no hace
 * falta validar cada campo contra su unión de valores válidos porque la
 * única fuente que escribe esta clave es este mismo formulario (controles
 * cerrados, sin texto libre); solo hay que blindar contra un JSON
 * corrupto o un cambio de forma entre versiones.
 */
export function parsearTemaGuardado(valorJson: string, colorAcentoLegacy: string): TemaTienda {
  try {
    const parseado = JSON.parse(valorJson);
    return {
      ...TEMA_DEFAULT,
      ...parseado,
      colorAcento: parseado.colorAcento ?? (colorAcentoLegacy || null),
      menu: Array.isArray(parseado.menu) && parseado.menu.length === MENU_DEFAULT.length ? parseado.menu : MENU_DEFAULT,
    };
  } catch {
    return { ...TEMA_DEFAULT, colorAcento: colorAcentoLegacy || null };
  }
}

export interface BannerAnuncioForm {
  mensajes: MensajeBannerAnuncio[];
  intervaloSegundos: number;
}

export const BANNER_ANUNCIO_DEFAULT: BannerAnuncioForm = { mensajes: [], intervaloSegundos: 5 };

/**
 * Parseo defensivo espejo de `resolverBannerAnuncio` (backend) — antes de
 * esta extensión la clave guardaba un string plano (un único mensaje,
 * siempre blanco sobre el acento del tema). Si el valor guardado no es
 * JSON, se materializa como ese mensaje legado con el acento ACTUAL como
 * color de fondo (en vez de "hereda del tema") — apenas el admin guarda una
 * vez desde este editor, el mensaje pasa a tener un color explícito, ya no
 * legado.
 */
export function parsearBannerAnuncioGuardado(valorCrudo: string, colorAcentoActual: string): BannerAnuncioForm {
  if (!valorCrudo) return BANNER_ANUNCIO_DEFAULT;
  try {
    const parseado = JSON.parse(valorCrudo);
    if (parseado && Array.isArray(parseado.mensajes)) {
      return {
        mensajes: parseado.mensajes.map((m: Partial<MensajeBannerAnuncio>) => ({
          texto: m.texto ?? '',
          colorFondo: m.colorFondo ?? colorAcentoActual,
          colorTexto: m.colorTexto ?? '#ffffff',
          tamanoFuente: m.tamanoFuente ?? 'NORMAL',
        })),
        intervaloSegundos: typeof parseado.intervaloSegundos === 'number' ? parseado.intervaloSegundos : 5,
      };
    }
  } catch {
    // no era JSON — es el string legado, tratado abajo.
  }
  return { mensajes: [{ texto: valorCrudo, colorFondo: colorAcentoActual, colorTexto: '#ffffff', tamanoFuente: 'NORMAL' }], intervaloSegundos: 5 };
}
