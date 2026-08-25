import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  titulo: string;
  onClose: () => void;
  children: ReactNode;
  /** 'lg' (default, formularios normales) o 'xl' (tablas anchas — ej. vista previa de importación). */
  ancho?: 'lg' | 'xl';
}

const ANCHOS = { lg: 'max-w-lg', xl: 'max-w-4xl' } as const;

/**
 * Overlay simple sin dependencias externas. Cierra al hacer click fuera del
 * panel o en la "×" — no atrapa el foco ni el scroll del body porque hoy
 * ningún formulario del proyecto lo necesita; si eso cambia, es el lugar
 * natural para agregarlo.
 *
 * El panel nunca puede ser más alto que la ventana (`max-h-[85vh]`) — con
 * un formulario largo, el contenido hace scroll DENTRO del modal
 * (`overflow-y-auto` en el body) mientras el título/botón de cerrar quedan
 * fijos arriba (`shrink-0`). Sin esto, un formulario largo simplemente
 * empujaba el modal fuera de la pantalla sin ninguna forma de llegar al
 * final.
 */
export function Modal({ titulo, onClose, children, ancho = 'lg' }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[85vh] w-full ${ANCHOS[ancho]} flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
