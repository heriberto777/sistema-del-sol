import { usePlantillasHorario } from '../../../hooks/usePlantillasHorario';
import { Select } from '../../atoms/Select/Select';

interface SelectPlantillaHorarioProps {
  value: string;
  onChange: (plantillaHorarioId: string) => void;
  id?: string;
}

/** Selector por id (Empleado.plantillaHorarioId es una FK real, referencia viva — ítem G-1) — mismo criterio que SelectPuesto. */
export function SelectPlantillaHorario({ value, onChange, id }: SelectPlantillaHorarioProps) {
  const { data: plantillas } = usePlantillasHorario();

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin plantilla (horario individual)</option>
      {plantillas?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre} ({p.codigo}){p.predeterminada ? ' — predeterminada' : ''}
        </option>
      ))}
    </Select>
  );
}
