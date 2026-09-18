/** Iniciales de un nombre completo, para avatares — antes vivía enterrada dentro de KanbanTareas.tsx (auditoría de estructura del frontend). */
export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase();
}
