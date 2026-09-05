import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { CarritoTiendaProvider } from './CarritoTiendaContext';
import { CarritoDrawerProvider } from './CarritoDrawerContext';
import { CarritoDrawer } from './CarritoDrawer';

/**
 * Envuelve las 7 rutas de tienda: una sola instancia de carrito compartida
 * (CarritoTiendaContext) y el estado de apertura del drawer
 * (CarritoDrawerContext), para que el drawer se pueda abrir desde
 * cualquiera de ellas — ver CarritoDrawer.tsx.
 *
 * `ScrollRestoration` — bug real reportado: al navegar del catálogo a un
 * producto (u otra ruta de tienda) React Router NUNCA resetea el scroll
 * por defecto; si el comprador venía desplazado hacia abajo, la página
 * nueva se renderiza pero la ventana se queda en el mismo Y de píxeles
 * — visualmente parece que "no pasó nada" aunque la URL/el componente sí
 * cambiaron. Este componente (soportado por `createBrowserRouter`, ver
 * router.tsx) sube al tope en cada navegación nueva y restaura la
 * posición al usar atrás/adelante, igual que un sitio multi-página real.
 */
export function TiendaLayout() {
  const subdominio = useSubdominioTienda();
  return (
    <CarritoTiendaProvider subdominio={subdominio}>
      <CarritoDrawerProvider>
        <Outlet />
        <CarritoDrawer subdominio={subdominio} />
        <ScrollRestoration />
      </CarritoDrawerProvider>
    </CarritoTiendaProvider>
  );
}
