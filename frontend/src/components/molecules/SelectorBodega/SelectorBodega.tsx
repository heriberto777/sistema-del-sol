import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Select } from '../../atoms/Select/Select';
import { useSucursalActiva } from '../../../hooks/useSucursalActiva';

interface Bodega {
  id: string;
  nombre: string;
  sucursalId: string;
}

interface SelectorBodegaProps {
  id?: string;
  value: string;
  onChange: (bodegaId: string) => void;
  required?: boolean;
}

/**
 * Reemplaza el `<Select>` de bodega duplicado en Facturación/Compras/POS/
 * Inventario — cuando hay una sucursal activa (Fase 8c), acota las
 * opciones a las bodegas de esa sucursal. Sin sucursal activa (o sin
 * ninguna sucursal asignada al usuario), muestra todas — puramente UX,
 * no es un límite de acceso (eso es Fase 9).
 */
export function SelectorBodega({ id, value, onChange, required }: SelectorBodegaProps) {
  const { sucursalActivaId } = useSucursalActiva();
  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-select'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  const opciones = (bodegas ?? []).filter((b) => !sucursalActivaId || b.sucursalId === sucursalActivaId);

  // Ítem "bodega por defecto" — si solo hay una opción posible (ya acotada
  // por sucursal activa), la precarga sola; el usuario la puede cambiar
  // igual si tiene más de una bodega disponible en otra sucursal.
  useEffect(() => {
    if (!value && opciones.length === 1) onChange(opciones[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, opciones.length]);

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">Seleccionar…</option>
      {opciones.map((b) => (
        <option key={b.id} value={b.id}>
          {b.nombre}
        </option>
      ))}
    </Select>
  );
}
