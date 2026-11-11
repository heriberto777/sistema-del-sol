import { marked } from 'marked';

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

/**
 * Pedido explícito del usuario (2026-11-11) — el `cuerpo` de una
 * plantilla de EMAIL se interpreta como Markdown antes de insertar las
 * variables, en vez de como HTML crudo: quien lo redacta escribe
 * `**negrita**` y simplemente aprieta Enter para un salto de línea (como
 * en WhatsApp/cualquier chat), y antes eso quedaba literal — `**` sin
 * convertir y sin ningún salto de línea real, porque HTML ignora un
 * `\n` suelto (bug real reportado, confirmado contra un email ya
 * enviado). `breaks: true` es lo que hace que ESE `\n` suelto se vuelva
 * `<br>` — sin esto, Markdown por sí solo tampoco lo arregla (CommonMark
 * exige dos espacios al final de la línea para eso, una convención que
 * nadie no-técnico conoce).
 *
 * Solo para EMAIL — el mismo `cuerpo` también se usa tal cual para
 * WHATSAPP (texto plano, Twilio no entiende HTML; y WhatsApp tiene SU
 * PROPIA sintaxis de formato con un solo asterisco `*negrita*`, distinta
 * e incompatible con `**negrita**` de Markdown) — parsear ahí rompería
 * el mensaje en vez de arreglarlo. El HTML crudo que ya tenían plantillas
 * viejas (`<strong>`, `<br>`) sigue funcionando: Markdown deja pasar HTML
 * embebido tal cual, no lo vuelve a escapar.
 *
 * Las variables se sustituyen DESPUÉS de convertir Markdown a propósito
 * (nunca antes): así un valor que contenga texto parecido a Markdown
 * (ej. un cliente que se llama "Juan **Perez**") no dispara formato por
 * accidente — ya se insertó en el HTML final, como texto escapado.
 */
export function renderizarPlantilla(cuerpo: string, variables: Record<string, string>, opciones?: { markdown?: boolean }): string {
  const base = opciones?.markdown ? (marked.parse(cuerpo, { breaks: true, async: false }) as string) : cuerpo;
  return base.replace(/{{\s*(\w+)\s*}}/g, (coincidencia, nombreVariable) =>
    Object.prototype.hasOwnProperty.call(variables, nombreVariable) ? escaparHtml(variables[nombreVariable]) : coincidencia,
  );
}
