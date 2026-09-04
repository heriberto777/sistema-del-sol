import { Link } from 'react-router-dom';
import { formatearPrecio } from '../../../hooks/useTienda';
import { PlantillaPedidoProps } from './tipos';
import { cantidadLinea, estadoMostrado, porcentajeDescuentoLinea, precioListaLinea, puedeIniciarPago, tieneDescuento } from './utilidades';

/** Estilo ticket térmico — mismo espíritu que el ticket que ya imprime el POS (`FormatoImpresion.TERMICA_*`). */
export function ReciboTermico({ datos, subdominio, onPagar, pagando, error }: PlantillaPedidoProps) {
  const estado = estadoMostrado(datos);

  return (
    <div className="w-full max-w-sm">
      <div className="relative bg-white px-7 py-8 font-mono text-[13px] text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100">
        <div className="text-center">
          <div className="text-lg font-bold uppercase tracking-wide">{datos.storeNombre}</div>
        </div>
        <hr className="my-4 border-t border-dashed border-slate-300 dark:border-slate-700" />
        <div className="flex flex-col gap-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span>PEDIDO N° {datos.numero}</span>
        </div>
        <div className="mt-3 text-center">
          <span
            className="inline-block -rotate-3 rounded border-2 px-3 py-1 text-xs font-bold tracking-widest"
            style={{ borderColor: datos.colorAcento, color: datos.colorAcento }}
          >
            {estado}
          </span>
        </div>
        <hr className="my-4 border-t border-dashed border-slate-300 dark:border-slate-700" />

        <div className="flex flex-col">
          {datos.lineas.map((linea, i) => (
            <div key={i} className="border-b border-dotted border-slate-300 py-2 dark:border-slate-700">
              <div className="flex justify-between gap-2">
                <span className="font-medium uppercase">
                  {cantidadLinea(linea)}x {linea.nombre}
                </span>
                <span className="tabular-nums">{formatearPrecio(linea.montoTotal)}</span>
              </div>
              {tieneDescuento(linea) && (
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span style={{ color: datos.colorAcento }}>OFERTA -{porcentajeDescuentoLinea(linea)}%</span>
                  <span className="tabular-nums line-through">{formatearPrecio(precioListaLinea(linea))}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-col gap-1 text-xs">
          <div className="flex justify-between">
            <span>SUBTOTAL</span>
            <span className="tabular-nums">{formatearPrecio(datos.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>ITBIS</span>
            <span className="tabular-nums">{formatearPrecio(datos.itbis)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-dashed border-slate-300 pt-2 text-base font-bold dark:border-slate-700">
            <span>TOTAL</span>
            <span className="tabular-nums">{formatearPrecio(datos.total)}</span>
          </div>
        </div>

        {datos.entrega && (
          <div className="mt-4 flex flex-col gap-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">CLIENTE</span> {datos.entrega.nombre}
            </div>
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">ENTREGA</span> {datos.entrega.direccion}
            </div>
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">TEL</span> {datos.entrega.telefono}
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-xs text-red-600 dark:text-red-400">{error}</p>}

        {puedeIniciarPago(datos) && (
          <button
            type="button"
            disabled={pagando}
            onClick={onPagar}
            className="mt-5 w-full rounded-sm py-2.5 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-60"
            style={{ background: datos.colorAcento }}
          >
            {pagando ? 'Redirigiendo…' : 'Pagar con tarjeta →'}
          </button>
        )}
        {!datos.pagada && datos.estado === 'EMITIDA' && !datos.pasarelaDisponible && (
          <p className="mt-4 text-center text-[11px] text-amber-600 dark:text-amber-400">Este negocio no tiene un pago en línea disponible todavía.</p>
        )}
        {datos.pagada && <p className="mt-4 text-center text-[11px] text-emerald-600 dark:text-emerald-400">Ya está pagado — gracias.</p>}
        {datos.estado === 'ANULADA' && <p className="mt-4 text-center text-[11px] text-slate-400">Este pedido fue anulado.</p>}

        <div
          className="mt-6 h-8 opacity-80"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px, currentColor 5px 6px, transparent 6px 11px, currentColor 11px 13px, transparent 13px 17px)',
          }}
        />
        <p className="mt-2 text-center text-[10px] tracking-widest text-slate-500 dark:text-slate-400">GRACIAS POR SU COMPRA</p>

        <div className="mt-4 flex justify-center gap-5 text-[11px]">
          <Link to={`/tienda/${subdominio}`} className="text-slate-900 hover:underline dark:text-slate-100">
            ‹ Seguir comprando
          </Link>
          <Link to={`/tienda/${subdominio}/mis-pedidos`} className="text-slate-500 hover:underline dark:text-slate-400">
            Mis pedidos
          </Link>
        </div>
      </div>
    </div>
  );
}
