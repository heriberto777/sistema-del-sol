import { Link, useParams } from 'react-router-dom';
import { formatearPrecio, useMisPedidos, useTiendaConfig } from '../../hooks/useTienda';
import { useClienteTienda } from '../../hooks/useClienteTienda';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

const ETIQUETA_ESTADO: Record<string, string> = {
  EMITIDA: 'Pendiente de pago',
  ANULADA: 'Anulada',
};

/** Genérico, no una piel más por plantilla — mismo criterio que TiendaCheckout/TiendaLogin. */
export function TiendaMisPedidos() {
  const { subdominio = '' } = useParams();
  const { data: config, isLoading: cargandoConfig, isError: errorConfig } = useTiendaConfig(subdominio);
  const { cliente, token, autenticado, cerrarSesion } = useClienteTienda(subdominio);
  const { data: pedidos, isLoading: cargandoPedidos, isError: errorPedidos } = useMisPedidos(subdominio, token);

  if (cargandoConfig) return <TiendaCargando />;
  if (errorConfig || !config) return <TiendaNoEncontrada />;

  if (!autenticado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center dark:bg-slate-950">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Iniciá sesión para ver tus pedidos</h1>
        <Link to={`/tienda/${subdominio}/login`} className="rounded-lg bg-sol-500 px-6 py-3 text-sm font-semibold text-white hover:bg-sol-600">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Mis pedidos</h1>
            {cliente && <p className="text-sm text-slate-500 dark:text-slate-400">{cliente.nombre}</p>}
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={cerrarSesion} className="text-sm text-slate-500 hover:underline dark:text-slate-400">
              Cerrar sesión
            </button>
            <Link to={`/tienda/${subdominio}`} className="text-sm text-sol-600 hover:underline dark:text-sol-400">
              Volver a la tienda
            </Link>
          </div>
        </div>

        {errorPedidos && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
            Tu sesión venció — <button type="button" onClick={cerrarSesion} className="underline">iniciá sesión de nuevo</button>.
          </div>
        )}

        {cargandoPedidos && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}

        {!cargandoPedidos && !errorPedidos && pedidos?.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no hiciste ningún pedido.</p>
        )}

        <div className="flex flex-col gap-3">
          {pedidos?.map(({ factura, pedido }) => (
            <div key={factura.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Factura {factura.numero ?? factura.ncf ?? factura.id.slice(0, 8)}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {new Date(factura.fecha).toLocaleDateString('es-DO')}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {factura.estado === 'ANULADA' ? ETIQUETA_ESTADO.ANULADA : factura.pagada ? 'Pagada' : ETIQUETA_ESTADO.EMITIDA}
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatearPrecio(factura.total)}</span>
              </div>
              {pedido && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Entrega: {pedido.direccionEntrega}</p>}
              {!factura.pagada && factura.estado !== 'ANULADA' && (
                <Link
                  to={`/pagar-factura/${factura.id}`}
                  className="mt-3 inline-block text-sm font-medium text-sol-600 hover:underline dark:text-sol-400"
                >
                  Pagar ahora →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
