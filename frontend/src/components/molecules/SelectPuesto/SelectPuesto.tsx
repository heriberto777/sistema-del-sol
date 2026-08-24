import { usePuestos } from '../../../hooks/usePuestos';
import { Select } from '../../atoms/Select/Select';

interface SelectPuestoProps {
  value: string;
  onChange: (puestoId: string) => void;
  id?: string;
  etiquetaVacio?: string;
}

/** Selector por id (Empleado.puestoId es una FK real) — mismo criterio que SelectListaPrecio/SelectCategoriaCliente. */
export function SelectPuesto({ value, onChange, id, etiquetaVacio = 'Sin puesto asignado' }: SelectPuestoProps) {
  const { data: puestos } = usePuestos();

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{etiquetaVacio}</option>
      {puestos?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
    </Select>
  );
}
