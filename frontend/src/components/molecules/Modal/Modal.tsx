import { ReactNode } from 'react';

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
 */
export function Modal({ titulo, onClose, children, ancho = 'lg' }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className={`w-full ${ANCHOS[ancho]} rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
