import { useLeyesFiscales } from '../../../hooks/useLeyesFiscales';
import { Select } from '../../atoms/Select/Select';

interface SelectLeyFiscalProps {
  value: string;
  onChange: (leyFiscalId: string) => void;
  id?: string;
}

/** Selector por id (Producto.leyFiscalId es una FK real) — mismo criterio que SelectCategoria/SelectListaPrecio. */
export function SelectLeyFiscal({ value, onChange, id }: SelectLeyFiscalProps) {
  const { data: leyes } = useLeyesFiscales();

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Ninguna (ITBIS normal del producto)</option>
      {leyes?.map((l) => (
        <option key={l.id} value={l.id}>
          {l.nombre} ({l.codigo}) — {Number(l.porcentajeItbisAPagar)}% del ITBIS
        </option>
      ))}
    </Select>
  );
}
