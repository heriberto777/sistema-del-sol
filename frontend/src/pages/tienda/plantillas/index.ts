import { directo } from './directo';
import { mercado } from './mercado';
import { boutique } from './boutique';
import { bruma } from './bruma';
import { bloque } from './bloque';
import { nodo } from './nodo';
import { chispa } from './chispa';
import { editorial } from './editorial';
import { base } from './base';
import { ropero } from './ropero';
import { amplia } from './amplia';
import { distrito } from './distrito';
import { atelier } from './atelier';
import { oficio } from './oficio';
import type { Plantilla } from './tipos';
import type { PlantillaTienda } from '../../../hooks/useTienda';

export const PLANTILLAS: Record<PlantillaTienda, Plantilla> = {
  DIRECTO: directo,
  MERCADO: mercado,
  BOUTIQUE: boutique,
  BRUMA: bruma,
  BLOQUE: bloque,
  NODO: nodo,
  CHISPA: chispa,
  EDITORIAL: editorial,
  BASE: base,
  ROPERO: ropero,
  AMPLIA: amplia,
  DISTRITO: distrito,
  ATELIER: atelier,
  OFICIO: oficio,
};

export type { Plantilla, PropsCarrito, PropsHome, PropsProducto } from './tipos';
