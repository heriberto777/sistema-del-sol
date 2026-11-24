import { Fragment, type ReactNode } from 'react';

interface NodoTiptap {
  type: string;
  content?: NodoTiptap[];
  text?: string;
  marks?: { type: string }[];
}

function renderizarTexto(nodo: NodoTiptap, key: number): ReactNode {
  let elemento: ReactNode = nodo.text ?? '';
  for (const marca of nodo.marks ?? []) {
    if (marca.type === 'bold') elemento = <strong>{elemento}</strong>;
    if (marca.type === 'italic') elemento = <em>{elemento}</em>;
  }
  return <Fragment key={key}>{elemento}</Fragment>;
}

function renderizarNodo(nodo: NodoTiptap, key: number): ReactNode {
  switch (nodo.type) {
    case 'text':
      return renderizarTexto(nodo, key);
    case 'hardBreak':
      return <br key={key} />;
    case 'paragraph':
      return (
        <p key={key} className="whitespace-pre-wrap">
          {nodo.content?.map(renderizarNodo)}
        </p>
      );
    case 'bulletList':
      return (
        <ul key={key} className="list-disc pl-5">
          {nodo.content?.map(renderizarNodo)}
        </ul>
      );
    case 'orderedList':
      return (
        <ol key={key} className="list-decimal pl-5">
          {nodo.content?.map(renderizarNodo)}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{nodo.content?.map(renderizarNodo)}</li>;
    default:
      return null;
  }
}

/**
 * Renderer de solo lectura para un documento de Tiptap (JSON) — recorre el
 * árbol a mano en vez de instanciar un editor de Tiptap por burbuja (caro,
 * y expone comandos de edición que acá no hacen falta). Solo conoce los
 * nodos/marcas de la misma lista blanca que valida el backend
 * (`validar-documento-tiptap.ts`) — cualquier otro tipo se ignora, nunca
 * se interpreta como HTML.
 */
export function ContenidoTiptap({ documento }: { documento: unknown }) {
  const doc = documento as NodoTiptap | null | undefined;
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) return null;
  return <>{doc.content.map(renderizarNodo)}</>;
}
