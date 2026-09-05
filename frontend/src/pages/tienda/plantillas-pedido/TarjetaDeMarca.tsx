import { Link } from 'react-router-dom';
import { formatearPrecio } from '../../../hooks/useTienda';
import { PlantillaPedidoProps } from './tipos';
import { cantidadLinea, estadoMostrado, porcentajeDescuentoLinea, precioListaLinea, puedeIniciarPago, tieneDescuento } from './utilidades';

/** Confirmación tipo checkout moderno — ícono de éxito + tarjeta con el color de acento de la tienda. */
export function TarjetaDeMarca({ datos, subdominio, onPagar, pagando, error }: PlantillaPedidoProps) {
  const estado = estadoMostrado(datos);

  return (
    <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      {datos.storeLogo && <img src={datos.storeLogo} alt="" className="mx-auto mb-4 h-9 w-auto max-w-[9rem] object-contain" />}
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-white"
        style={{ background: estado === 'ANULADA' ? '#94a3b8' : datos.colorAcento }}
      >
        {estado === 'ANULADA' ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {estado === 'ANULADA' ? 'Pedido anulado' : datos.pagada ? '¡Pedido pagado!' : '¡Pedido confirmado!'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{datos.storeNombre}</p>
      </div>

      <div className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        Pedido <span className="font-semibold text-slate-900 dark:text-slate-100">{datos.numero}</span>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {datos.lineas.map((linea, i) => (
          <div key={i} className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${datos.colorAcento}22`, color: datos.colorAcento }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                <path d="M8 4l2 2h4l2-2 4 3-3 4h-2v9H9v-9H7L4 7l4-3z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{linea.nombre}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Cant. {cantidadLinea(linea)}</p>
              {tieneDescuento(linea) && (
                <span
                  className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: datos.colorAcento }}
                >
                  -{porcentajeDescuentoLinea(linea)}% OFF
                </span>
              )}
            </div>
            <div className="shrink-0 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
              {formatearPrecio(linea.montoTotal)}
              {tieneDescuento(linea) && (
                <span className="block text-xs font-normal text-slate-400 line-through dark:text-slate-500">
                  {formatearPrecio(precioListaLinea(linea))}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-1.5 border-t border-dashed border-slate-200 pt-4 text-sm dark:border-slate-700">
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatearPrecio(datos.subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>ITBIS</span>
          <span className="tabular-nums">{formatearPrecio(datos.itbis)}</span>
        </div>
        <div className="flex justify-between pt-1 text-lg font-extrabold text-slate-900 dark:text-slate-100">
          <span>Total</span>
          <span className="tabular-nums">{formatearPrecio(datos.total)}</span>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {puedeIniciarPago(datos) && (
        <button
          type="button"
          disabled={pagando}
          onClick={onPagar}
          className="mt-5 w-full rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: datos.colorAcento }}
        >
          {pagando ? 'Redirigiendo…' : 'Pagar con tarjeta'}
        </button>
      )}
      {!datos.pagada && datos.estado === 'EMITIDA' && !datos.pasarelaDisponible && (
        <p className="mt-4 text-center text-xs text-amber-600 dark:text-amber-400">Este negocio no tiene un pago en línea disponible todavía.</p>
      )}
      {datos.pagada && <p className="mt-4 text-center text-xs text-emerald-600 dark:text-emerald-400">Esta factura ya fue pagada — gracias.</p>}

      {datos.entrega && (
        <div className="mt-5 rounded-2xl p-3.5 text-xs text-slate-500 dark:text-slate-400" style={{ background: `${datos.colorAcento}12` }}>
          <b className="text-slate-900 dark:text-slate-100">Entrega:</b> {datos.entrega.direccion} · {datos.entrega.telefono}
        </div>
      )}

      <div className="mt-5 flex justify-center gap-5 text-sm">
        <Link to={`/tienda/${subdominio}`} className="font-semibold hover:underline" style={{ color: datos.colorAcento }}>
          ‹ Volver a la tienda
        </Link>
        <Link to={`/tienda/${subdominio}/mis-pedidos`} className="font-medium text-slate-500 hover:underline dark:text-slate-400">
          Ver mis pedidos
        </Link>
      </div>
    </div>
  );
}
