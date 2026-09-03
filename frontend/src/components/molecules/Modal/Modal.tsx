import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  titulo: string;
  onClose: () => void;
  children: ReactNode;
  /** 'lg' (default, formularios normales), 'xl' (tablas anchas — ej. vista previa de importación) o '2xl' ("ver detalle" de un documento — más ancho en desktop/tablet para ver artículos/totales sin scroll horizontal). */
  ancho?: 'lg' | 'xl' | '2xl';
}

const ANCHOS = { lg: 'max-w-lg', xl: 'max-w-4xl', '2xl': 'max-w-5xl' } as const;

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
 *
 * `overflow-x-hidden` en el body es una red de seguridad, no el fix en sí
 * — un contenido interno (ej. una grilla densa de inputs, como pasó en
 * ModalCerrarTurno de TurnoCajaDetalle.tsx) que no cede al ancho del panel
 * generaba un scroll horizontal ahí mismo con columnas cortadas/
 * desalineadas, porque `overflow-y-auto` sin `overflow-x` explícito hace
 * que el navegador trate el eje X también como `auto` (regla CSS: si un
 * eje es `visible` y el otro no, el `visible` se computa como `auto`). El
 * fix real sigue siendo que cada modal haga que su contenido quepa/ceda;
 * esto solo evita que un caso no detectado se vea roto en vez de, en el
 * peor caso, recortado.
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
        <div className="overflow-x-hidden overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
