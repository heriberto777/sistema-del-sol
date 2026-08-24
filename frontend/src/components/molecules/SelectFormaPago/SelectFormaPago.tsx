import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Select } from '../../atoms/Select/Select';

export interface FormaPago {
  id: string;
  nombre: string;
  requiereReferencia: boolean;
  esEfectivo: boolean;
  esBono: boolean;
  esPuntosLealtad: boolean;
}

interface SelectFormaPagoProps {
  value: string;
  onChange: (formaPagoId: string, forma: FormaPago | undefined) => void;
  id?: string;
}

/** Reemplaza el enum fijo EFECTIVO/TARJETA/TRANSFERENCIA — trae el catálogo configurable del tenant (Admin → Formas de pago). */
export function SelectFormaPago({ value, onChange, id }: SelectFormaPagoProps) {
  const { data: formasPago } = useQuery({
    queryKey: ['formas-pago-activas'],
    queryFn: async () => (await apiClient.get<FormaPago[]>('/formas-pago', { params: { activa: true } })).data,
  });

  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value, formasPago?.find((f) => f.id === e.target.value))}
      required
    >
      <option value="">Seleccionar…</option>
      {formasPago?.map((forma) => (
        <option key={forma.id} value={forma.id}>
          {forma.nombre}
        </option>
      ))}
    </Select>
  );
}
