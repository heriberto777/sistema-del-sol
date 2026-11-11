import { useTerminosPago, type TerminoPago } from '../../../hooks/useTerminosPago';
import { Select } from '../../atoms/Select/Select';

interface SelectTerminoPagoProps {
  value: string;
  onChange: (terminoPagoId: string, termino: TerminoPago | undefined) => void;
  /** Filtra el catálogo compartido CxC/CxP a lo que aplica aquí (un termino "AMBOS" siempre se incluye). */
  aplicaA: 'CLIENTE' | 'PROVEEDOR';
  id?: string;
  disabled?: boolean;
}

/**
 * Opcional a propósito — omitirlo mantiene el comportamiento de siempre
 * (el plazo suelto del cliente/proveedor, `plazoPagoDias`). Elegir un
 * término aquí solo da una fuente catalogada opcional con días +
 * descuento por pronto pago, nunca lo reemplaza.
 */
export function SelectTerminoPago({ value, onChange, aplicaA, id, disabled }: SelectTerminoPagoProps) {
  const { data: terminos } = useTerminosPago();
  const opciones = terminos?.filter((t) => t.aplicaA === aplicaA || t.aplicaA === 'AMBOS');

  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value, opciones?.find((t) => t.id === e.target.value))}
      disabled={disabled}
    >
      <option value="">Sin término (usa el plazo general)</option>
      {opciones?.map((t) => (
        <option key={t.id} value={t.id}>
          {t.nombre} — {t.dias} días
          {t.descuentoProntoPagoPct ? ` (${t.descuentoProntoPagoPct}% pronto pago)` : ''}
        </option>
      ))}
    </Select>
  );
}
