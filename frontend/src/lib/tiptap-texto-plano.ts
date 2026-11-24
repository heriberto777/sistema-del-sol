interface NodoTiptap {
  type?: string;
  text?: string;
  content?: NodoTiptap[];
}

/** Preview en texto plano de un documento de Tiptap — fila de lista tipo bandeja (mismo criterio que `WhatsappMensaje.contenido` en Mensajes.tsx). */
export function textoPlanoDesdeTiptap(documento: unknown): string {
  const partes: string[] = [];
  function recorrer(nodo: unknown) {
    if (!nodo || typeof nodo !== 'object') return;
    const n = nodo as NodoTiptap;
    if (n.type === 'text' && typeof n.text === 'string') partes.push(n.text);
    n.content?.forEach(recorrer);
  }
  recorrer(documento);
  return partes.join(' ').trim();
}
