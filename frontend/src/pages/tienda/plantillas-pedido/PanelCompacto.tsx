import { Link } from 'react-router-dom';
import { formatearPrecio } from '../../../hooks/useTienda';
import { PlantillaPedidoProps } from './tipos';
import { cantidadLinea, estadoMostrado, puedeIniciarPago } from './utilidades';

const TONO_ESTADO: Record<string, string> = {
  PAGADA: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
  ANULADA: 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
  EMITIDA: 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
  BORRADOR: 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
};

/** Resumen tipo panel/dashboard — filas alineadas, cifras tabulares, estado como chip. */
export function PanelCompacto({ datos, subdominio, onPagar, pagando, error }: PlantillaPedidoProps) {
  const estado = estadoMostrado(datos);

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">Pedido {datos.numero}</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{datos.storeNombre}</p>
        </div>
        <span className={`shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${TONO_ESTADO[estado]}`}>{estado}</span>
      </div>

      <div className="mt-4 border-t border-slate-200 dark:border-slate-800">
        {datos.lineas.map((linea, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-2.5 border-b border-slate-200 py-2.5 text-[13px] dark:border-slate-800">
            <span className="font-medium text-slate-900 dark:text-slate-100">{linea.nombre}</span>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{cantidadLinea(linea)} ×</span>
            <span className="text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">{formatearPrecio(linea.montoTotal)}</span>
          </div>
        ))}
      </div>

      <div className="py-3 font-mono text-[13px]">
        <div className="flex justify-between py-1 text-slate-500 dark:text-slate-400">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatearPrecio(datos.subtotal)}</span>
        </div>
        <div className="flex justify-between py-1 text-slate-500 dark:text-slate-400">
          <span>ITBIS</span>
          <span className="tabular-nums">{formatearPrecio(datos.itbis)}</span>
        </div>
        <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-2.5 font-sans text-base font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100">
          <span>Total</span>
          <span className="tabular-nums">{formatearPrecio(datos.total)}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {puedeIniciarPago(datos) && (
        <button
          type="button"
          disabled={pagando}
          onClick={onPagar}
          className="mt-2 w-full rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: datos.colorAcento }}
        >
          {pagando ? 'Redirigiendo…' : 'Pagar con tarjeta'}
        </button>
      )}
      {!datos.pagada && datos.estado === 'EMITIDA' && !datos.pasarelaDisponible && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">Este negocio no tiene un pago en línea disponible todavía.</p>
      )}
      {datos.pagada && <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">Esta factura ya fue pagada — gracias.</p>}

      {datos.entrega && (
        <div className="mt-4 flex flex-col gap-0.5 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <b className="font-medium text-slate-900 dark:text-slate-100">Cliente</b> {datos.entrega.nombre}
          </div>
          <div>
            <b className="font-medium text-slate-900 dark:text-slate-100">Entrega</b> {datos.entrega.direccion}
          </div>
          <div>
            <b className="font-medium text-slate-900 dark:text-slate-100">Teléfono</b> {datos.entrega.telefono}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-between border-t border-slate-200 pt-3.5 text-xs dark:border-slate-800">
        <Link to={`/tienda/${subdominio}`} className="font-semibold" style={{ color: datos.colorAcento }}>
          ‹ Volver a la tienda
        </Link>
        <Link to={`/tienda/${subdominio}/mis-pedidos`} className="font-medium text-slate-500 dark:text-slate-400">
          Ver mis pedidos
        </Link>
      </div>
    </div>
  );
}
