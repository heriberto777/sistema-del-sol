import { RefObject, useLayoutEffect } from 'react';

/**
 * Autoexpande un `<textarea rows={N} className="resize-none">` según su
 * contenido (altura = scrollHeight) cada vez que `valor` cambia, hasta
 * `maxPx` — pasado ese punto vuelve a scrollear adentro en vez de seguir
 * creciendo sin límite (ej. un comentario pegado muy largo). Sin esto, un
 * textarea con `rows` fijo + `resize-none` queda estático: el usuario
 * sigue escribiendo pero el cuadro nunca crece y el texto ya tipeado
 * desaparece scrolleado adentro de una caja de 2-3 líneas (bug real
 * reportado en los comentarios de tareas).
 */
export function useAutoAlturaTextarea(ref: RefObject<HTMLTextAreaElement>, valor: string, maxPx = 320) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [ref, valor, maxPx]);
}
