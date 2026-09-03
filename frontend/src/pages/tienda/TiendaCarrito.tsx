import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { useTiendaConfig } from '../../hooks/useTienda';
import { useCarritoTiendaContext } from './CarritoTiendaContext';
import { PLANTILLAS } from './plantillas';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

export function TiendaCarrito() {
  const subdominio = useSubdominioTienda();
  const carrito = useCarritoTiendaContext();
  const { data: config, isLoading, isError } = useTiendaConfig(subdominio);

  if (isLoading) return <TiendaCargando />;
  if (isError || !config) return <TiendaNoEncontrada />;

  const Carrito = PLANTILLAS[config.plantilla].Carrito;
  return <Carrito config={config} subdominio={subdominio} carrito={carrito} />;
}
