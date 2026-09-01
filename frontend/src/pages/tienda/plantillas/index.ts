import { directo } from './directo';
import { mercado } from './mercado';
import { boutique } from './boutique';
import type { Plantilla } from './tipos';
import type { PlantillaTienda } from '../../../hooks/useTienda';

export const PLANTILLAS: Record<PlantillaTienda, Plantilla> = { DIRECTO: directo, MERCADO: mercado, BOUTIQUE: boutique };

export type { Plantilla, PropsCarrito, PropsHome, PropsProducto } from './tipos';
