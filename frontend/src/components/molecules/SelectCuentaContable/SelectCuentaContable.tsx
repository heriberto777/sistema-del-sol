import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Select } from '../../atoms/Select/Select';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

interface SelectCuentaContableProps {
  value: string;
  onChange: (cuentaContableId: string) => void;
  /** Filtra el catálogo a un solo tipo (ej. "INGRESO"/"GASTO") — omitir para mostrar todas. */
  tipo?: string;
  id?: string;
}

/** Para parametrizar qué cuenta usar en un flujo (ej. Categoria.cuentaIngresoId/cuentaCostoId) — mismo patrón de fetch que SelectCuentaBancaria. */
export function SelectCuentaContable({ value, onChange, tipo, id }: SelectCuentaContableProps) {
  const { data } = useQuery({
    queryKey: ['contabilidad-cuentas-select'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });
  const opciones = tipo ? (data ?? []).filter((c) => c.tipo === tipo) : (data ?? []);

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin especificar (cuenta genérica)</option>
      {opciones.map((cuenta) => (
        <option key={cuenta.id} value={cuenta.id}>
          {cuenta.codigo} — {cuenta.nombre}
        </option>
      ))}
    </Select>
  );
}
