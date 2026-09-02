import { Outlet, useParams } from 'react-router-dom';
import { CarritoTiendaProvider } from './CarritoTiendaContext';
import { CarritoDrawerProvider } from './CarritoDrawerContext';
import { CarritoDrawer } from './CarritoDrawer';

/** Envuelve las 7 rutas de tienda: una sola instancia de carrito compartida (CarritoTiendaContext) y el estado de apertura del drawer (CarritoDrawerContext), para que el drawer se pueda abrir desde cualquiera de ellas — ver CarritoDrawer.tsx. */
export function TiendaLayout() {
  const { subdominio = '' } = useParams();
  return (
    <CarritoTiendaProvider subdominio={subdominio}>
      <CarritoDrawerProvider>
        <Outlet />
        <CarritoDrawer subdominio={subdominio} />
      </CarritoDrawerProvider>
    </CarritoTiendaProvider>
  );
}
