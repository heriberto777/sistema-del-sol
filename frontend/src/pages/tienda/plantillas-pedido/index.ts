import { ComponentType } from 'react';
import { PlantillaPedidoTienda } from '../../../hooks/useTienda';
import { PlantillaPedidoProps } from './tipos';
import { ReciboTermico } from './ReciboTermico';
import { TarjetaDeMarca } from './TarjetaDeMarca';
import { BoutiqueCalido } from './BoutiqueCalido';
import { PanelCompacto } from './PanelCompacto';

export const PLANTILLAS_PEDIDO: Record<PlantillaPedidoTienda, ComponentType<PlantillaPedidoProps>> = {
  RECIBO: ReciboTermico,
  MARCA: TarjetaDeMarca,
  BOUTIQUE: BoutiqueCalido,
  PANEL: PanelCompacto,
};

export * from './tipos';
