import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { Select } from '../../atoms/Select/Select';
import { ComboboxBusqueda } from '../ComboboxBusqueda/ComboboxBusqueda';
import { useVariantesProducto, etiquetaVariante } from '../../../hooks/useVariantesProducto';

export interface ProductoOpcion {
  id: string;
  nombre: string;
  codigo: string;
  /** Precio de lista GENERAL, vigente — solo referencia visual (ver `onChange`), nunca el precio real a facturar. */
  precioVenta?: string | null;
  /** % de ITBIS del producto — junto con `precioVenta`, solo para estimar el ITBIS en el panel lateral; el real lo resuelve el backend (puede variar por ley fiscal del producto). */
  porcentajeItbis?: string | number | null;
}

interface SelectorLineaProductoProps {
  /** Usado solo para resolver la etiqueta del producto ya elegido (ej. al editar una línea existente) sin esperar la primera búsqueda — la búsqueda en sí siempre va contra el backend, no filtra esta lista. */
  productos: ProductoOpcion[];
  productoId: string;
  varianteId: string;
  /**
   * `precioReferencia` solo se pasa cuando se elige un producto NUEVO
   * (no al resolver la variante por defecto) — precio de lista GENERAL,
   * para que el formulario pueda mostrar un subtotal estimado mientras se
   * arma el documento. Nunca confundir con el precio real: el backend
   * resuelve el precio de verdad al guardar (lista del cliente, ofertas
   * vigentes) y puede diferir de esta referencia.
   */
  onChange: (productoId: string, varianteId: string, precioReferencia?: string | null, itbisReferencia?: string | number | null) => void;
  className?: string;
}

/**
 * Buscador de producto + (solo si aplica) select de variante — antes un
 * <select> nativo con hasta 100 productos sin ningún buscador (auditoría
 * de UX: con más de un puñado de productos, encontrar el correcto a
 * fuerza de scroll era poco práctico). Ahora usa `ComboboxBusqueda`
 * (mismo componente ya usado para Cliente) contra `/productos?busqueda=`
 * — busca por nombre, código o código de barras, sin el límite de 100
 * que tenía el <select>.
 *
 * Reemplaza el `<Select>` de producto duplicado en cada formulario de
 * línea (Facturación/Cotizaciones/Remisiones/Compras/POS). Un producto
 * sin atributos reales (la inmensa mayoría) tiene una única variante
 * "por defecto": acá se resuelve sola y no se muestra ningún select
 * adicional — mismo criterio que `VariantesService.resolverObligatoria`
 * en el backend, solo que resuelto en el cliente para no obligar a
 * elegir nada que no aplica.
 */
export function SelectorLineaProducto({ productos, productoId, varianteId, onChange, className }: SelectorLineaProductoProps) {
  const { data: variantes } = useVariantesProducto(productoId);
  const [productoElegido, setProductoElegido] = useState<ProductoOpcion | null>(
    () => productos.find((p) => p.id === productoId) ?? null,
  );

  // Mantiene `productoElegido` en sincronía si `productoId` cambia desde
  // afuera (ej. al cargar una línea ya existente al editar, o si React
  // reusa esta instancia para otra línea del array tras quitar una fila).
  useEffect(() => {
    if (!productoId) {
      setProductoElegido(null);
    } else if (productoElegido?.id !== productoId) {
      setProductoElegido(productos.find((p) => p.id === productoId) ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId]);

  useEffect(() => {
    if (variantes?.length === 1 && varianteId !== variantes[0].id) {
      // Repetir `precioReferencia` (no omitirlo) — si no, este onChange
      // "silencioso" (solo resuelve la variante única) pisaría con
      // `undefined` el precio ya guardado por la selección del producto,
      // ya que `TablaLineasEditable` mergea los 3 campos del onChange sin
      // distinguir cuál vino de dónde.
      onChange(productoId, variantes[0].id, productoElegido?.precioVenta, productoElegido?.porcentajeItbis);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantes]);

  return (
    <div className={className}>
      <ComboboxBusqueda<ProductoOpcion>
        valor={productoElegido}
        onSeleccionar={(p) => {
          setProductoElegido(p);
          onChange(p?.id ?? '', '', p?.precioVenta, p?.porcentajeItbis);
        }}
        obtenerId={(p) => p.id}
        obtenerEtiqueta={(p) => `${p.codigo} — ${p.nombre}`}
        placeholder="Buscar producto…"
        buscar={async (texto) =>
          (await apiClient.get<PaginaResultado<ProductoOpcion>>('/productos', { params: { busqueda: texto, tamanoPagina: 10 } })).data
            .datos
        }
      />
      {variantes && variantes.length > 1 && (
        <Select value={varianteId} onChange={(e) => onChange(productoId, e.target.value)} required className="mt-1.5">
          <option value="">Variante…</option>
          {variantes.map((v) => (
            <option key={v.id} value={v.id}>
              {etiquetaVariante(v) || '(sin atributos)'}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
