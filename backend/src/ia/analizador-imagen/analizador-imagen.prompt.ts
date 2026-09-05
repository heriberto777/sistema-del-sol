import { ServiceUnavailableException } from '@nestjs/common';
import { CandidatoProducto } from './analizador-imagen.interface';

export const CANTIDAD_CANDIDATOS = 3;

const PROMPT_BASE = `Analizá esta foto de un producto para el catálogo de una tienda en República Dominicana.
Generá EXACTAMENTE ${CANTIDAD_CANDIDATOS} opciones distintas de nombre y descripción corta para este producto, en español dominicano, pensadas para un catálogo de venta (no repitas la misma redacción entre opciones — variá el enfoque: una más literal/directa, una más comercial, una más detallada).
El nombre: máximo 6 palabras, sin marca inventada si no es visible en la foto.
La descripción: 1-2 oraciones, máximo 30 palabras, sin inventar características que no se puedan confirmar por la imagen (material, marca, talla exacta, etc. — si no se ve, no lo asumas).
Respondé ÚNICAMENTE con un JSON válido, sin texto antes ni después, con esta forma exacta:
{"opciones":[{"nombre":"...","descripcion":"..."},{"nombre":"...","descripcion":"..."},{"nombre":"...","descripcion":"..."}]}`;

/**
 * Mismo prompt para los 3 proveedores — así las opciones que ve el admin
 * son comparables entre sí, no un estilo distinto por casualidad del
 * modelo. `detalle` es el texto opcional que el admin tipea junto a la
 * foto (marca, material, talla, uso, etc.) — a diferencia de lo que "se
 * ve" en la imagen, esto viene directo de quien conoce el producto de
 * primera mano, así que el prompt lo marca como fuente confiable en vez
 * de aplicarle la misma regla de "no inventes" que al resto.
 */
export function construirPromptAnalizarProducto(detalle?: string): string {
  const detalleLimpio = detalle?.trim();
  if (!detalleLimpio) return PROMPT_BASE;
  return `${PROMPT_BASE}

El administrador de la tienda dio este detalle adicional sobre el producto — es información real que él conoce de primera mano (no algo que tengas que confirmar en la foto), así que podés usarla con la misma confianza que lo que se ve en la imagen. Igual seguí sin inventar nada que no esté ni en la foto ni en este texto:
"""${detalleLimpio}"""`;
}

/**
 * Defensivo a propósito — un modelo de IA puede envolver el JSON en texto
 * extra o markdown pese a que se le pidió que no lo haga (pasa más de lo
 * que uno esperaría). Extrae el primer bloque `{...}` del texto antes de
 * parsear, y valida la forma real antes de confiar en ella — nunca se le
 * devuelve al frontend algo que no sean exactamente `CandidatoProducto[]`.
 */
export function parsearCandidatos(textoCrudo: string, proveedor: string): CandidatoProducto[] {
  const inicio = textoCrudo.indexOf('{');
  const fin = textoCrudo.lastIndexOf('}');
  if (inicio === -1 || fin === -1 || fin < inicio) {
    throw new ServiceUnavailableException(`${proveedor} no devolvió un resultado que se pueda usar — probá de nuevo`);
  }

  let parseado: unknown;
  try {
    parseado = JSON.parse(textoCrudo.slice(inicio, fin + 1));
  } catch {
    throw new ServiceUnavailableException(`${proveedor} no devolvió un resultado que se pueda usar — probá de nuevo`);
  }

  const opciones = (parseado as { opciones?: unknown }).opciones;
  if (!Array.isArray(opciones) || opciones.length === 0) {
    throw new ServiceUnavailableException(`${proveedor} no devolvió ninguna opción — probá de nuevo`);
  }

  const candidatos = opciones
    .filter((o): o is { nombre: unknown; descripcion: unknown } => !!o && typeof o === 'object')
    .map((o) => ({ nombre: String(o.nombre ?? '').trim(), descripcion: String(o.descripcion ?? '').trim() }))
    .filter((c) => c.nombre.length > 0);

  if (candidatos.length === 0) {
    throw new ServiceUnavailableException(`${proveedor} no devolvió ninguna opción usable — probá de nuevo`);
  }
  return candidatos;
}
