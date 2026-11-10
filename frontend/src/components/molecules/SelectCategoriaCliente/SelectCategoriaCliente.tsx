import { useCategoriasCliente } from '../../../hooks/useCategoriasCliente';
import { Select } from '../../atoms/Select/Select';

interface SelectCategoriaClienteProps {
  value: string;
  onChange: (categoriaId: string) => void;
  id?: string;
  disabled?: boolean;
}

/** Selector por id (Cliente.categoriaId es una FK real) — mismo criterio que SelectListaPrecio. */
export function SelectCategoriaCliente({ value, onChange, id, disabled }: SelectCategoriaClienteProps) {
  const { data: categorias } = useCategoriasCliente();

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">Sin categoría</option>
      {categorias?.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </Select>
  );
}
