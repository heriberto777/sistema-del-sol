import { useParams } from 'react-router-dom';
import { useTiendaConfig } from '../../hooks/useTienda';
import { useCarritoTienda } from '../../hooks/useCarritoTienda';
import { PLANTILLAS } from './plantillas';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

export function TiendaCarrito() {
  const { subdominio = '' } = useParams();
  const carrito = useCarritoTienda(subdominio);
  const { data: config, isLoading, isError } = useTiendaConfig(subdominio);

  if (isLoading) return <TiendaCargando />;
  if (isError || !config) return <TiendaNoEncontrada />;

  const Carrito = PLANTILLAS[config.plantilla].Carrito;
  return <Carrito config={config} subdominio={subdominio} carrito={carrito} />;
}
