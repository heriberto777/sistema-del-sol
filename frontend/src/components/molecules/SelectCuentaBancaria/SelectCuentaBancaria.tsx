import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Select } from '../../atoms/Select/Select';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface CuentaBancaria {
  id: string;
  banco: string;
  numeroCuenta: string;
}

interface SelectCuentaBancariaProps {
  value: string;
  onChange: (cuentaBancariaId: string) => void;
  id?: string;
}

/**
 * Para elegir de qué banco real entró/salió un pago (Pagos, punto 1 de
 * docs/PLAN.md) — mismo patrón de fetch que GastoMenorNuevo.tsx. Siempre
 * opcional: el caller decide cuándo mostrarlo (solo tiene sentido si la
 * forma de pago elegida no es efectivo).
 */
export function SelectCuentaBancaria({ value, onChange, id }: SelectCuentaBancariaProps) {
  const { data } = useQuery({
    queryKey: ['cuentas-bancarias-activas'],
    queryFn: async () => (await apiClient.get<PaginaResultado<CuentaBancaria>>('/bancos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin especificar (cuenta genérica)</option>
      {data?.map((cuenta) => (
        <option key={cuenta.id} value={cuenta.id}>
          {cuenta.banco} — {cuenta.numeroCuenta}
        </option>
      ))}
    </Select>
  );
}
