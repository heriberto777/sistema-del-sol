import { useEffect } from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { CarritoTiendaProvider } from './CarritoTiendaContext';
import { CarritoDrawerProvider } from './CarritoDrawerContext';
import { CarritoDrawer } from './CarritoDrawer';
import { TiendaTemaProvider, useTiendaTema } from './TiendaTemaContext';

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
    <TiendaTemaProvider>
      <TiendaLayoutInterno subdominio={subdominio} />
    </TiendaTemaProvider>
  );
}

/**
 * Aplica el modo claro/oscuro DE LA TIENDA a un wrapper propio (nunca a
 * `<html>`) — así el `dark:` de Tailwind que ya usan Checkout/Categoría/
 * Productos/Directo/Mercado reacciona solo a la preferencia del comprador,
 * nunca a la del panel admin (mismo `ThemeProvider` global, mismo
 * `<html>`, ver `contexts/ThemeContext.tsx`). El efecto además LIMPIA
 * cualquier `.dark` que el admin ya le haya puesto a `<html>` mientras esta
 * pantalla esté montada (y lo restaura al salir) — sin esto, un `<html
 * class="dark">` puesto por el admin seguiría activando el `dark:` de estas
 * páginas por más que la tienda diga "claro" (un selector `.dark X` de
 * Tailwind matchea CUALQUIER ancestro con esa clase, no solo el más cercano).
 */
function TiendaLayoutInterno({ subdominio }: { subdominio: string }) {
  const { modo } = useTiendaTema();

  useEffect(() => {
    const html = document.documentElement;
    const teniaDarkDeAdmin = html.classList.contains('dark');
    html.classList.remove('dark');
    return () => {
      if (teniaDarkDeAdmin) html.classList.add('dark');
    };
  }, []);

  return (
    <div className={modo === 'oscuro' ? 'dark' : undefined}>
      <CarritoTiendaProvider subdominio={subdominio}>
        <CarritoDrawerProvider>
          <Outlet />
          <CarritoDrawer subdominio={subdominio} />
          <ScrollRestoration />
        </CarritoDrawerProvider>
      </CarritoTiendaProvider>
    </div>
  );
}
