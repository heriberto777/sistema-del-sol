import { useState } from 'react';
import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { useCategoriasTienda, useTiendaCatalogo, useTiendaConfig } from '../../hooks/useTienda';
import { useCarritoTiendaContext } from './CarritoTiendaContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PLANTILLAS } from './plantillas';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

export function TiendaHome() {
  const subdominio = useSubdominioTienda();
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | undefined>(undefined);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const carrito = useCarritoTiendaContext();

  const { data: config, isLoading, isError } = useTiendaConfig(subdominio);
  const { data: pagina, isLoading: cargandoCatalogo } = useTiendaCatalogo(subdominio, { busqueda: busquedaDebounced || undefined, categoriaId });
  const { data: categorias = [] } = useCategoriasTienda(subdominio);

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
      categorias={categorias}
      categoriaId={categoriaId}
      onCategoriaSeleccionar={setCategoriaId}
    />
  );
}
