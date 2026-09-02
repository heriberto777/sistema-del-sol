import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTiendaCatalogo, useTiendaConfig } from '../../hooks/useTienda';
import { useCarritoTiendaContext } from './CarritoTiendaContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PLANTILLAS } from './plantillas';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

export function TiendaHome() {
  const { subdominio = '' } = useParams();
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebouncedValue(busqueda);
  const carrito = useCarritoTiendaContext();

  const { data: config, isLoading, isError } = useTiendaConfig(subdominio);
  const { data: pagina, isLoading: cargandoCatalogo } = useTiendaCatalogo(subdominio, { busqueda: busquedaDebounced || undefined });

  if (isLoading) return <TiendaCargando />;
  if (isError || !config) return <TiendaNoEncontrada />;

  const Home = PLANTILLAS[config.plantilla].Home;
  return (
    <Home
      config={config}
      subdominio={subdominio}
      carrito={carrito}
      productos={pagina?.datos ?? []}
      cargando={cargandoCatalogo}
      busqueda={busqueda}
      onBuscar={setBusqueda}
    />
  );
}
