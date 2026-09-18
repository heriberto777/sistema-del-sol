/**
 * Escapa cada variable antes de insertarla — el `cuerpo` de una
 * `NotificacionPlantilla` es HTML (lo edita el propio tenant, ver
 * NotificacionesController), pero varias variables salen de datos que
 * puede escribir un tercero sin cuenta (ej. `cliente_nombre` desde el
 * registro público de la Tienda Online, `contenido` de un comentario).
 * Sin este escape, un nombre como `<img src=x onerror=...>` quedaría
 * como HTML real en el email — hallazgo real de la auditoría de XSS,
 * mismo criterio que ya usan documento-ticket.ts/los construirEmail*Html.
 * Los links (`{{link}}`) que arma el propio backend (URLs con solo
 * letras/números/guiones) no necesitan un caso especial: escaparlos es
 * inocuo para ellos y sigue siendo válido dentro de un href="...".
 */
function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderizarPlantilla(cuerpo: string, variables: Record<string, string>): string {
  return cuerpo.replace(/{{\s*(\w+)\s*}}/g, (coincidencia, nombreVariable) =>
    Object.prototype.hasOwnProperty.call(variables, nombreVariable) ? escaparHtml(variables[nombreVariable]) : coincidencia,
  );
}
