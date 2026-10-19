import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Select } from '../../atoms/Select/Select';

interface UnidadConversionProducto {
  unidadMedidaId: string;
  unidadMedida: { id: string; nombre: string };
}

interface ProductoConversion {
  unidadMedidaBaseId: string | null;
  unidadMedidaBase: { id: string; nombre: string } | null;
  unidadesConversion: UnidadConversionProducto[];
}

interface SelectorUnidadLineaProps {
  productoId: string;
  /** '' = unidad base del producto (comportamiento histórico, sin conversión) — nunca se manda `undefined` a mano, el caller lo convierte al armar el payload. */
  value: string;
  onChange: (unidadMedidaId: string) => void;
  className?: string;
}

/**
 * Selector de unidad de compra/venta por línea (ej. "Caja" = 144 unidades) —
 * opt-in: no renderiza nada si el producto no tiene unidadMedidaBaseId
 * configurado (la inmensa mayoría), para no agregar ruido visual a líneas
 * que no lo necesitan. Ver ARCHITECTURE.md "Conversión de unidades de
 * medida" y ProductosService.resolverFactorConversion en el backend.
 */
export function SelectorUnidadLinea({ productoId, value, onChange, className }: SelectorUnidadLineaProps) {
  const { data: producto } = useQuery({
    queryKey: ['producto-conversion-unidades', productoId],
    queryFn: async () => (await apiClient.get<ProductoConversion>(`/productos/${productoId}`)).data,
    enabled: !!productoId,
    staleTime: 60 * 1000,
  });

  if (!producto?.unidadMedidaBaseId) return null;

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">{producto.unidadMedidaBase?.nombre} (base)</option>
      {producto.unidadesConversion.map((u) => (
        <option key={u.unidadMedidaId} value={u.unidadMedidaId}>
          {u.unidadMedida.nombre}
        </option>
      ))}
    </Select>
  );
}
