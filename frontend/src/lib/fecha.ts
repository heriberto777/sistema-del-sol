/**
 * Utilidades genéricas de fecha/duración — antes vivían enterradas dentro
 * de KanbanTareas.tsx (auditoría de estructura del frontend), con
 * `soloFecha` además duplicada carácter por carácter en MisTareas.tsx.
 */

/**
 * `fechaIso` es un día calendario, no un instante — llega como medianoche
 * UTC. Armar la fecha a partir de los componentes del string evita que
 * retroceda un día en cualquier huso detrás de UTC.
 */
export function soloFecha(fechaIso: string): Date {
  const [anio, mes, dia] = fechaIso.slice(0, 10).split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

export function formatoFechaHoraComentario(fecha: string): string {
  const d = new Date(fecha);
  return `${d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })}`;
}

export function formatearDuracion(ms: number): string {
  const minutos = Math.max(0, Math.floor(ms / 60_000));
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  return horas > 0 ? `${horas}h ${minutosRestantes}m` : `${minutosRestantes}m`;
}
