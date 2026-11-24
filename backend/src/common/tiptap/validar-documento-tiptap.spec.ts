import { esDocumentoTiptapValido, textoPlanoDesdeTiptap } from './validar-documento-tiptap';

describe('validar-documento-tiptap', () => {
  describe('esDocumentoTiptapValido', () => {
    it('acepta párrafo simple con negrita/cursiva', () => {
      const doc = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hola', marks: [{ type: 'bold' }, { type: 'italic' }] }] },
        ],
      };
      expect(esDocumentoTiptapValido(doc)).toBe(true);
    });

    it('acepta listas (bulletList/orderedList/listItem) y hardBreak', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }] }],
          },
          { type: 'paragraph', content: [{ type: 'hardBreak' }, { type: 'text', text: 'siguiente línea' }] },
        ],
      };
      expect(esDocumentoTiptapValido(doc)).toBe(true);
    });

    it('rechaza un nodo fuera de la lista blanca (ej. image/codeBlock)', () => {
      const doc = { type: 'doc', content: [{ type: 'image', attrs: { src: 'x' } }] };
      expect(esDocumentoTiptapValido(doc)).toBe(false);
    });

    it('rechaza una marca fuera de la lista blanca (ej. underline/link)', () => {
      const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'evil' } }] }] }] };
      expect(esDocumentoTiptapValido(doc)).toBe(false);
    });

    it('rechaza un documento vacío o sin type doc', () => {
      expect(esDocumentoTiptapValido({ type: 'doc', content: [] })).toBe(false);
      expect(esDocumentoTiptapValido({ type: 'paragraph', content: [] })).toBe(false);
      expect(esDocumentoTiptapValido(null)).toBe(false);
      expect(esDocumentoTiptapValido('<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('textoPlanoDesdeTiptap', () => {
    it('concatena el texto de todos los nodos de texto', () => {
      const doc = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'mundo' }] },
        ],
      };
      expect(textoPlanoDesdeTiptap(doc)).toBe('Hola mundo');
    });
  });
});
