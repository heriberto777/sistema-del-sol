import { Plus, X } from 'lucide-react';
import { SelectorLineaProducto, ProductoOpcion } from '../SelectorLineaProducto/SelectorLineaProducto';
import { formatearOferta, type OfertaVisibleProducto } from '../../../lib/formatear-oferta';

export interface LineaEditable {
  productoId: string;
  varianteId: string;
  cantidad: string;
  precioUnitario: string;
  /** Precio de lista GENERAL del producto elegido — solo para el subtotal estimado del panel lateral, nunca se envía al backend. */
  precioReferencia?: string | null;
  /** % de ITBIS del producto elegido — junto con `precioReferencia`, solo para estimar el ITBIS del panel lateral, nunca se envía al backend. */
  itbisReferencia?: string | number | null;
  /** Oferta automática vigente del producto elegido — solo para la insignia de la fila, nunca se envía al backend. */
  oferta?: OfertaVisibleProducto | null;
  esManual: boolean;
  descripcionManual: string;
  aplicaItbis?: boolean;
}

function formatearPrecio(precio: string | number) {
  return Number(precio).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Tabla de líneas para los modales de "crear" (Factura/Cotización) —
 * reemplaza las filas `flex` sueltas que cada uno construía por su
 * cuenta con la misma estructura de tabla, para que ambos se vean
 * consistentes entre sí (y con "Ver detalle", que usa el mismo criterio
 * de columnas vía `TablaArticulosDocumento`). El toggle "Producto libre"
 * (ítem B-9) y el de ITBIS por línea (ítem B-7, `mostrarItbis`) son los
 * mismos de antes, solo reordenados en columnas de tabla.
 *
 * Genérico sobre `T extends LineaEditable` para que Factura (que además
 * trae `aplicaItbis`) y Cotización (que no) puedan compartir el mismo
 * componente sin castear tipos.
 */
export function TablaLineasEditable<T extends LineaEditable>({
  lineas,
  productos,
  lineaVacia,
  onActualizar,
  onQuitar,
  onAgregar,
  mostrarItbis = false,
  precioSoloManual = false,
}: {
  lineas: T[];
  productos: ProductoOpcion[];
  lineaVacia: T;
  onActualizar: (index: number, cambios: Partial<T>) => void;
  onQuitar: (index: number) => void;
  onAgregar: (lineaVacia: T) => void;
  mostrarItbis?: boolean;
  /** Si es true, el precio solo se edita en una línea manual — una línea de catálogo usa el precio vigente del producto sin override (comportamiento previo de Cotizaciones, a diferencia de Facturación). */
  precioSoloManual?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Descripción</th>
              <th className="w-20 px-3 py-2 font-medium">Cant</th>
              <th className="w-32 px-3 py-2 font-medium">Precio</th>
              {mostrarItbis && <th className="w-16 px-3 py-2 text-center font-medium">ITBIS</th>}
              <th className="w-px px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {lineas.map((linea, i) => (
              <tr key={i}>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    {linea.esManual ? (
                      <input
                        type="text"
                        placeholder="Descripción — ej. Instalación"
                        value={linea.descripcionManual}
                        onChange={(e) => onActualizar(i, { descripcionManual: e.target.value } as Partial<T>)}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    ) : (
                      <>
                        <SelectorLineaProducto
                          productos={productos}
                          productoId={linea.productoId}
                          varianteId={linea.varianteId}
                          onChange={(productoId, varianteId, precioReferencia, itbisReferencia, oferta) =>
                            onActualizar(i, { productoId, varianteId, precioReferencia, itbisReferencia, oferta } as Partial<T>)
                          }
                        />
                        {linea.oferta && (
                          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                            🏷️ {formatearOferta(linea.oferta)}
                          </span>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      title={linea.esManual ? 'Volver a elegir del catálogo' : 'Línea libre sin producto del catálogo (ítem B-9)'}
                      onClick={() =>
                        onActualizar(i, { esManual: !linea.esManual, productoId: '', varianteId: '', descripcionManual: '' } as Partial<T>)
                      }
                      className="self-start text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
                    >
                      {linea.esManual ? 'Del catálogo' : 'Producto libre'}
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 align-top">
                  <input
                    type="number"
                    min={1}
                    step="any"
                    placeholder="Cant."
                    value={linea.cantidad}
                    onChange={(e) => onActualizar(i, { cantidad: e.target.value } as Partial<T>)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-col gap-1">
                    {!linea.esManual && linea.precioReferencia != null && (
                      <span
                        className="font-mono text-xs text-slate-500 dark:text-slate-400"
                        title="Precio de lista GENERAL — referencia, el backend resuelve el precio real al guardar (lista del cliente, ofertas vigentes)"
                      >
                        RD$ {formatearPrecio(linea.precioReferencia)}
                      </span>
                    )}
                    {(!precioSoloManual || linea.esManual) && (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder={linea.esManual ? 'Precio' : 'Opcional'}
                        value={linea.precioUnitario}
                        onChange={(e) => onActualizar(i, { precioUnitario: e.target.value } as Partial<T>)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    )}
                  </div>
                </td>
                {mostrarItbis && (
                  <td className="px-3 py-2 text-center align-top">
                    <input
                      type="checkbox"
                      title="Toggle de ITBIS por línea"
                      checked={linea.aplicaItbis ?? true}
                      onChange={(e) => onActualizar(i, { aplicaItbis: e.target.checked } as Partial<T>)}
                    />
                  </td>
                )}
                <td className="px-3 py-2 align-top">
                  {lineas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onQuitar(i)}
                      className="text-red-600 hover:text-red-700"
                      aria-label="Quitar línea"
                    >
                      <X size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => onAgregar(lineaVacia)}
        className="flex items-center gap-1 text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
      >
        <Plus size={15} /> Agregar línea
      </button>
    </div>
  );
}
