import { useEffect } from 'react';
import { Select } from '../../atoms/Select/Select';
import { useVariantesProducto, etiquetaVariante } from '../../../hooks/useVariantesProducto';

export interface ProductoOpcion {
  id: string;
  nombre: string;
  codigo: string;
}

interface SelectorLineaProductoProps {
  productos: ProductoOpcion[];
  productoId: string;
  varianteId: string;
  onChange: (productoId: string, varianteId: string) => void;
  className?: string;
}

/**
 * Select de producto + (solo si aplica) select de variante — Fase 3c,
 * incremento 4. Reemplaza el `<Select>` de producto duplicado en cada
 * formulario de línea (Facturación/Cotizaciones/Remisiones/Compras/POS).
 * Un producto sin atributos reales (la inmensa mayoría) tiene una única
 * variante "por defecto": acá se resuelve sola y no se muestra ningún
 * select adicional — mismo criterio que `VariantesService.
 * resolverObligatoria` en el backend, solo que resuelto en el cliente
 * para no obligar a elegir nada que no aplica.
 */
export function SelectorLineaProducto({ productos, productoId, varianteId, onChange, className }: SelectorLineaProductoProps) {
  const { data: variantes } = useVariantesProducto(productoId);

  useEffect(() => {
    if (variantes?.length === 1 && varianteId !== variantes[0].id) {
      onChange(productoId, variantes[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantes]);

  return (
    <div className={className}>
      <Select
        value={productoId}
        onChange={(e) => onChange(e.target.value, '')}
        required
        className={variantes && variantes.length > 1 ? 'mb-1.5' : undefined}
      >
        <option value="">Producto…</option>
        {productos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.codigo} — {p.nombre}
          </option>
        ))}
      </Select>
      {variantes && variantes.length > 1 && (
        <Select value={varianteId} onChange={(e) => onChange(productoId, e.target.value)} required>
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
