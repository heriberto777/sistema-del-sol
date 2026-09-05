import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { useTiendaConfig } from '../../hooks/useTienda';
import { useCarritoTiendaContext } from './CarritoTiendaContext';
import { PLANTILLAS } from './plantillas';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

/**
 * Vidriera curada (banner/Destacados/Ofertas/Secciones) — ya NO trae el
 * catálogo completo (pedido explícito, "opción B"): navegar TODO el
 * catálogo o buscar es la página dedicada `/productos`
 * (`TiendaProductos.tsx`), con paginación real. Antes este contenedor
 * resolvía `useTiendaCatalogo`/`useCategoriasTienda`/búsqueda para
 * pasárselos al Home de cada plantilla — ya no hace falta, cada plantilla
 * resuelve sus propios Destacados/Ofertas/Secciones vía hooks internos.
 */
export function TiendaHome() {
  const subdominio = useSubdominioTienda();
  const carrito = useCarritoTiendaContext();
  const { data: config, isLoading, isError } = useTiendaConfig(subdominio);

  if (isLoading) return <TiendaCargando />;
  if (isError || !config) return <TiendaNoEncontrada />;

  const Home = PLANTILLAS[config.plantilla].Home;
  return <Home config={config} subdominio={subdominio} carrito={carrito} />;
}
