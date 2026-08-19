import { useListasPrecio } from '../../../hooks/useListasPrecio';
import { Select } from '../../atoms/Select/Select';

interface SelectListaPrecioProps {
  value: string;
  onChange: (listaPrecioId: string) => void;
  id?: string;
}

/** Selector por id (Cliente.listaPrecioId es una FK real) — para el override por nombre al facturar/POS ver useListasPrecio directo. */
export function SelectListaPrecio({ value, onChange, id }: SelectListaPrecioProps) {
  const { data: listasPrecio } = useListasPrecio();

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin nivel asignado (usa GENERAL)</option>
      {listasPrecio?.map((lista) => (
        <option key={lista.id} value={lista.id}>
          {lista.nombre}
        </option>
      ))}
    </Select>
  );
}
