/** Datos reales del tenant usados para armar la sugerencia — nunca datos inventados (ver construirPromptComportamientoBot). */
export interface ContextoNegocio {
  nombre: string;
  direccion: string | null;
  categorias: string[];
  productos: string[];
}

/**
 * A diferencia de `construirPromptAnalizarProducto` (analiza una foto),
 * acá no hay imagen — el único material real disponible es lo que el
 * tenant ya cargó (nombre, dirección si la completó, categorías y una
 * muestra de productos). No existe ningún campo de horario en el
 * sistema hoy, así que el prompt pide explícitamente NO inventarlo.
 */
export function construirPromptComportamientoBot(ctx: ContextoNegocio): string {
  return `Redactá un texto breve (4 a 6 líneas) que describa este negocio dominicano, para que lo use como contexto un bot de WhatsApp que atiende a sus clientes. Tono cercano y profesional, en español dominicano.

Datos reales de este negocio:
- Nombre: ${ctx.nombre}
- Dirección: ${ctx.direccion || 'no especificada'}
- Categorías de productos: ${ctx.categorias.length > 0 ? ctx.categorias.join(', ') : 'sin categorías cargadas'}
- Ejemplos de productos del catálogo: ${ctx.productos.length > 0 ? ctx.productos.join(', ') : 'sin productos cargados todavía'}

Reglas estrictas:
- No inventes horario de atención, promociones, ni ningún dato que no esté en la lista de arriba.
- Si no tenés el horario, escribí literalmente "[Completar horario de atención]" en el lugar donde iría.
- Si no hay dirección, omitila en vez de inventar una.
- Devolvé ÚNICAMENTE el texto final, sin comillas, sin markdown, sin explicaciones antes o después.`;
}
