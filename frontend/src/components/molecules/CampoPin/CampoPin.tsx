import { useAuth } from '../../../hooks/useAuth';
import { FormField } from '../FormField/FormField';

interface CampoPinProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

/**
 * Fase 9 — confirmación de identidad para acciones sensibles (anular
 * factura, cerrar turno con diferencia/ajeno, ajuste negativo de stock).
 * No se muestra si el usuario no configuró un PIN ("Cambiar mi PIN" en el
 * menú de usuario) — el backend no lo exige en ese caso (default
 * permisivo). No se marca `required`: el backend solo lo exige en ciertas
 * condiciones (ej. diferencia de arqueo, turno ajeno, salida de stock) que
 * no siempre son calculables de antemano en el formulario.
 */
export function CampoPin({ value, onChange, id = 'pin-confirmacion' }: CampoPinProps) {
  const { usuario } = useAuth();
  if (!usuario?.tienePin) return null;

  return (
    <FormField
      id={id}
      label="PIN de confirmación"
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
