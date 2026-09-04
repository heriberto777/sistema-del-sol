import { Link } from 'react-router-dom';
import { formatearPrecio } from '../../../hooks/useTienda';
import { PlantillaPedidoProps } from './tipos';
import { cantidadLinea, estadoMostrado, puedeIniciarPago, tieneDescuento } from './utilidades';

/** Tono boutique/atelier — a tono con las plantillas cálidas de la tienda (Atelier, Boutique, Oficio). */
export function BoutiqueCalido({ datos, subdominio, onPagar, pagando, error }: PlantillaPedidoProps) {
  const estado = estadoMostrado(datos);
  const primerNombre = datos.entrega?.nombre.split(' ')[0];

  return (
    <div
      className="w-full max-w-sm border border-[#ddccb2] bg-[#f8f2e8] px-9 py-11 shadow-2xl dark:border-[#46392a] dark:bg-[#2b2219]"
      style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
    >
      <div className="text-center text-sm tracking-[0.3em]" style={{ color: datos.colorAcento }}>
        ✦
      </div>
      <div className="mt-2 text-center">
        <p className="text-balance text-2xl italic leading-snug text-[#2b3a3a] dark:text-[#f1e9dc]">
          {estado === 'ANULADA' ? 'Pedido anulado' : primerNombre ? `Gracias por tu compra, ${primerNombre}` : 'Gracias por tu compra'}
        </p>
        <p className="mt-2 font-sans text-xs text-[#6f6255] dark:text-[#c2ac8e]">
          Pedido N.º {datos.numero} · {datos.storeNombre}
        </p>
      </div>

      <div className="mx-auto my-6 h-px w-10 bg-[#ddccb2] dark:bg-[#46392a]" />

      <div className="flex flex-col gap-4 font-sans">
        {datos.lineas.map((linea, i) => (
          <div key={i} className="flex justify-between gap-4">
            <div>
              <p className="text-[15px]" style={{ fontFamily: "'Georgia', serif" }}>
                {linea.nombre}
              </p>
              <p className="text-xs text-[#6f6255] dark:text-[#c2ac8e]">
                {cantidadLinea(linea)} {cantidadLinea(linea) === 1 ? 'unidad' : 'unidades'}
              </p>
              {tieneDescuento(linea) && (
                <p className="text-[10px] uppercase tracking-wide" style={{ color: datos.colorAcento }}>
                  Oferta aplicada
                </p>
              )}
            </div>
            <div className="shrink-0 text-sm text-[#2b3a3a] dark:text-[#f1e9dc]">{formatearPrecio(linea.montoTotal)}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-1.5 border-t border-[#ddccb2] pt-4 font-sans text-sm text-[#2b3a3a] dark:border-[#46392a] dark:text-[#f1e9dc]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatearPrecio(datos.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>ITBIS</span>
          <span className="tabular-nums">{formatearPrecio(datos.itbis)}</span>
        </div>
        <div className="flex justify-between pt-1 text-2xl" style={{ fontFamily: "'Georgia', serif" }}>
          <span>Total</span>
          <span className="tabular-nums">{formatearPrecio(datos.total)}</span>
        </div>
      </div>

      {error && <p className="mt-4 font-sans text-sm text-red-700 dark:text-red-400">{error}</p>}

      {puedeIniciarPago(datos) && (
        <button
          type="button"
          disabled={pagando}
          onClick={onPagar}
          className="mt-6 w-full border border-[#2b3a3a] py-3 font-sans text-sm tracking-wide text-[#2b3a3a] transition-colors hover:bg-[#2b3a3a] hover:text-[#f8f2e8] disabled:opacity-60 dark:border-[#f1e9dc] dark:text-[#f1e9dc] dark:hover:bg-[#f1e9dc] dark:hover:text-[#2b2219]"
        >
          {pagando ? 'Redirigiendo…' : 'Pagar con tarjeta'}
        </button>
      )}
      {!datos.pagada && datos.estado === 'EMITIDA' && !datos.pasarelaDisponible && (
        <p className="mt-4 text-center font-sans text-xs text-[#9a5a2c]">Este negocio no tiene un pago en línea disponible todavía.</p>
      )}
      {datos.pagada && <p className="mt-4 text-center font-sans text-xs" style={{ color: datos.colorAcento }}>Esta factura ya fue pagada — gracias.</p>}

      {datos.entrega && (
        <p className="mt-6 text-center font-sans text-xs italic text-[#6f6255] dark:text-[#c2ac8e]">
          Se entrega en {datos.entrega.direccion}
          <br />
          {datos.entrega.telefono}
        </p>
      )}

      <div className="mt-6 flex justify-center gap-6 font-sans text-[11px] uppercase tracking-wide">
        <Link to={`/tienda/${subdominio}`} style={{ color: datos.colorAcento }}>
          Seguir comprando
        </Link>
        <Link to={`/tienda/${subdominio}/mis-pedidos`} className="text-[#6f6255] dark:text-[#c2ac8e]">
          Mis pedidos
        </Link>
      </div>
    </div>
  );
}
