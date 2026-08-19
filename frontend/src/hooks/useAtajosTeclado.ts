import { useEffect } from 'react';

const NO_ESCRIBE_CARACTER = /^F\d{1,2}$/;

function estaEscribiendoTexto(elemento: EventTarget | null): boolean {
  if (!(elemento instanceof HTMLElement)) return false;
  const tag = elemento.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || elemento.isContentEditable;
}

/**
 * Atajos de teclado a nivel de documento (F2-F12, ⇧F12, Escape) para el
 * modo pantalla completa del POS. Las teclas Fn y Escape no escriben
 * caracteres, así que se disparan aunque el foco esté en un input (el
 * cajero puede estar tipeando una búsqueda); cualquier otra tecla mapeada
 * se ignora con el foco en un campo de texto libre, para no pisar la
 * escritura normal.
 */
export function useAtajosTeclado(atajos: Record<string, () => void>, activo = true) {
  useEffect(() => {
    if (!activo) return;

    function onKeyDown(e: KeyboardEvent) {
      const clave = e.shiftKey ? `Shift+${e.key}` : e.key;
      const handler = atajos[clave];
      if (!handler) return;
      const esSeguraEnTexto = NO_ESCRIBE_CARACTER.test(e.key) || e.key === 'Escape';
      if (estaEscribiendoTexto(e.target) && !esSeguraEnTexto) return;

      e.preventDefault();
      handler();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [atajos, activo]);
}
