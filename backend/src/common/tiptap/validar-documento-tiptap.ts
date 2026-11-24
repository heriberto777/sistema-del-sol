/**
 * Lista blanca de nodos/marcas de Tiptap que este proyecto acepta — Soporte
 * Técnico guarda el cuerpo de cada mensaje como JSON de Tiptap (nunca HTML
 * crudo) y lo valida contra esta lista ANTES de persistir, para que un
 * cliente que no pase por la UI no pueda colar un nodo/marca fuera de lo
 * que el editor realmente ofrece (negrita/cursiva/listas/párrafos).
 */
const TIPOS_NODO_PERMITIDOS = new Set(['doc', 'paragraph', 'text', 'bulletList', 'orderedList', 'listItem', 'hardBreak']);
const TIPOS_MARCA_PERMITIDOS = new Set(['bold', 'italic']);

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function validarNodo(valor: unknown): boolean {
  if (!esObjeto(valor)) return false;
  const tipo = valor.type;
  if (typeof tipo !== 'string' || !TIPOS_NODO_PERMITIDOS.has(tipo)) return false;

  if (tipo === 'text') {
    if (typeof valor.text !== 'string' || valor.text.length === 0) return false;
    if (valor.marks === undefined) return true;
    if (!Array.isArray(valor.marks)) return false;
    return valor.marks.every((m) => esObjeto(m) && typeof m.type === 'string' && TIPOS_MARCA_PERMITIDOS.has(m.type));
  }

  if (valor.content === undefined) return tipo === 'hardBreak';
  if (!Array.isArray(valor.content) || valor.content.length === 0) return false;
  return valor.content.every(validarNodo);
}

/** true si `valor` es un documento Tiptap con solo los nodos/marcas de la lista blanca. */
export function esDocumentoTiptapValido(valor: unknown): boolean {
  if (!esObjeto(valor) || valor.type !== 'doc') return false;
  if (!Array.isArray(valor.content) || valor.content.length === 0) return false;
  return valor.content.every(validarNodo);
}

/** Extrae el texto plano de un documento Tiptap — preview de lista, sin HTML/JSON. */
export function textoPlanoDesdeTiptap(valor: unknown): string {
  if (!esObjeto(valor)) return '';
  const partes: string[] = [];
  function recorrer(nodo: unknown) {
    if (!esObjeto(nodo)) return;
    if (nodo.type === 'text' && typeof nodo.text === 'string') partes.push(nodo.text);
    if (Array.isArray(nodo.content)) nodo.content.forEach(recorrer);
  }
  recorrer(valor);
  return partes.join(' ').trim();
}
