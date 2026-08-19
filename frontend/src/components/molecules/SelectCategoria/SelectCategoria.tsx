import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { aplanarArbolCategorias, type CategoriaPlana } from '../../../lib/categorias-arbol';
import { Select } from '../../atoms/Select/Select';

interface SelectCategoriaProps {
  value: string;
  onChange: (categoriaId: string) => void;
  id?: string;
  /** Excluye esta categoría (y no filtra a sus descendientes) — usar al editar, para no poder asignarse a sí misma como padre. */
  excluirId?: string;
}

/** Select nativo con indentación por nivel — reemplaza el `categoria` de texto libre. El árbol se arma en el cliente a partir del listado plano (ver aplanarArbolCategorias). */
export function SelectCategoria({ value, onChange, id, excluirId }: SelectCategoriaProps) {
  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => (await apiClient.get<CategoriaPlana[]>('/categorias')).data,
  });

  const plano = aplanarArbolCategorias((categorias ?? []).filter((c) => c.id !== excluirId));

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin categoría</option>
      {plano.map((c) => (
        <option key={c.id} value={c.id}>
          {'— '.repeat(c.profundidad)}
          {c.nombre}
        </option>
      ))}
    </Select>
  );
}
