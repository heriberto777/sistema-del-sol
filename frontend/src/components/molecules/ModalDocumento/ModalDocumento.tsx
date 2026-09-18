import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalDocumentoProps {
  titulo: string;
  onClose: () => void;
  /** Formulario — columna izquierda, scrollea independiente del panel lateral. */
  children: ReactNode;
  /** Panel lateral fijo (cliente, cantidad de líneas, totales) — nunca se pierde de vista al scrollear el formulario. */
  resumen: ReactNode;
  /** Botones de acción, al pie del panel lateral — siempre visibles, no forman parte del contenido que scrollea. */
  acciones: ReactNode;
}

/**
 * Variante de Modal (mismo mecanismo de overlay/Escape/cierre con "×") para
 * los 3 formularios de "documento con líneas" — Nueva/Editar Factura,
 * Cotización y Remisión — que antes usaban `Modal` a secas: una sola
 * columna larga (datos + tabla de líneas + descuentos) donde el botón de
 * guardar terminaba varias pantallas por debajo de donde el usuario podía
 * verlo, sin ningún resumen visible mientras tanto (hallazgo de UX
 * reportado con captura — el usuario no encontraba el botón).
 *
 * Acá el formulario sigue scrolleando en la columna izquierda tal cual
 * antes, pero cliente/líneas/total y los botones de acción viven en un
 * panel lateral que nunca se mueve — no hace falta llegar al final del
 * formulario para guardar ni para ver cuánto va a quedar la factura.
 *
 * En pantallas angostas (`lg:` para abajo) el panel lateral pasa a vivir
 * debajo del formulario en vez de al costado — no hay espacio horizontal
 * para las dos columnas.
 */
export function ModalDocumento({ titulo, onClose, children, resumen, acciones }: ModalDocumentoProps) {
  useEffect(() => {
    const alPresionarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alPresionarTecla);
    return () => window.removeEventListener('keydown', alPresionarTecla);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-y-hidden">
          <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-6">{children}</div>
          {/* Panel lateral: `resumen` y `acciones` scrollean por separado — si
              `resumen` crece (ej. varios recargos cargados), el botón de
              abajo sigue fijo, nunca se va con el scroll. */}
          <div className="flex shrink-0 flex-col border-t border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 lg:w-72 lg:border-l lg:border-t-0">
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex flex-col gap-4">{resumen}</div>
            </div>
            <div className="shrink-0 border-t border-slate-200 p-5 dark:border-slate-800">
              <div className="flex flex-col gap-2">{acciones}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
