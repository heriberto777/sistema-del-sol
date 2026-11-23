import { useCentrosCosto } from '../../../hooks/useCentrosCosto';
import { Select } from '../../atoms/Select/Select';

interface SelectCentroCostoProps {
  value: string;
  onChange: (centroCostoId: string) => void;
  id?: string;
}

/** Centro de Costo (docs/PLAN.md, punto 3) — siempre opcional, independiente de Proyecto (son dos dimensiones que se combinan, no se reemplazan). */
export function SelectCentroCosto({ value, onChange, id }: SelectCentroCostoProps) {
  const { data: centros } = useCentrosCosto();

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin centro de costo</option>
      {centros?.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </Select>
  );
}
