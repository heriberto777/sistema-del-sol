/** Extraído de TravelReservas.tsx (auditoría UX Fase 5) — compartido entre los paneles de Resumen, Reservas, Buscar vuelo y Buscar hotel. */
export function formatoMoneda(monto: string, moneda: string) {
  return `${moneda} ${Number(monto).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
