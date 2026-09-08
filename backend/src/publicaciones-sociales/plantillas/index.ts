import type { FuncionPlantilla } from './tipos';
import { dibujarPrecioDestacado } from './precio-destacado.plantilla';
import { dibujarMinimalista } from './minimalista.plantilla';
import { dibujarOferta } from './oferta.plantilla';

export * from './tipos';
export { PLANTILLAS_PUBLICACION_SOCIAL_BASE } from './plantillas-publicacion-social.base';

/** `clave` (de `PlantillaPublicacionSocial`) → función de dibujo real. */
export const FUNCIONES_PLANTILLA: Record<string, FuncionPlantilla> = {
  'precio-destacado': dibujarPrecioDestacado,
  minimalista: dibujarMinimalista,
  oferta: dibujarOferta,
};
