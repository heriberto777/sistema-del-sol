import { Link } from 'react-router-dom';

/** Texto literal que manda TravelConfigService cuando el tenant no cargó su cuenta — ver obtenerCredencialesDuffel/obtenerCredencialesHotelbeds. */
const SIN_CUENTA_PROPIA = 'todavía no configuró su cuenta de';

/**
 * Extraído de TravelReservas.tsx (auditoría UX Fase 5) — compartido entre
 * Buscar vuelo y Buscar hotel. Error de búsqueda/reserva — si es por falta
 * de cuenta propia, agrega el link directo a Configuración → Viajes en vez
 * de dejar al usuario adivinar qué hacer.
 */
export function ErrorBusquedaTravel({ mensaje }: { mensaje: string }) {
  if (!mensaje.includes(SIN_CUENTA_PROPIA)) {
    return <p className="text-sm text-red-600 dark:text-red-400">{mensaje}</p>;
  }
  return (
    <p className="text-sm text-red-600 dark:text-red-400">
      {mensaje}{' '}
      <Link to="/travel-config" className="font-medium underline">
        Ir a Configuración → Viajes
      </Link>
    </p>
  );
}
