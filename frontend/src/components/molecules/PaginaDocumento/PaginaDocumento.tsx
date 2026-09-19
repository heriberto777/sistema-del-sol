import { ReactNode, useEffect } from 'react';
import { Link, useBlocker } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Modal } from '../Modal/Modal';
import { Button } from '../../atoms/Button/Button';

interface PaginaDocumentoProps {
  titulo: string;
  /** Ruta de la lista a la que vuelve el link "Volver" y el botón "Cancelar". */
  rutaVolver: string;
  etiquetaVolver: string;
  /** Si hay cambios sin guardar — bloquea la navegación (Volver, sidebar, atrás del navegador) con una confirmación propia, y el cierre/recarga de la pestaña con el diálogo nativo del navegador (el único que no se puede reemplazar). */
  haycambios: boolean;
  /** Formulario — columna principal, scrollea con el resto de la página. */
  children: ReactNode;
  /** Panel lateral (cliente, líneas, totales) — fijo (`sticky`) en desktop, debajo del formulario en pantallas angostas. */
  resumen: ReactNode;
  /** Botones de acción, al pie del panel lateral. */
  acciones: ReactNode;
}

/**
 * Equivalente en página completa de `ModalDocumento` (Opción B → Modelo B
 * de la exploración "modal o página") — mismo concepto de dos columnas,
 * pero como ruta propia en vez de overlay: más ancho para la tabla de
 * líneas y el panel de totales, sin el límite de alto de un modal
 * (`max-h-[85vh]`).
 *
 * Al dejar de ser un overlay que se cierra con la "×", cerrar sin guardar
 * deja de ser gratis — de ahí el guard de `haycambios` con `useBlocker`
 * (funciona porque `router.tsx` usa `createBrowserRouter`, un data router).
 */
export function PaginaDocumento({ titulo, rutaVolver, etiquetaVolver, haycambios, children, resumen, acciones }: PaginaDocumentoProps) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => haycambios && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!haycambios) return;
    const alIntentarSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', alIntentarSalir);
    return () => window.removeEventListener('beforeunload', alIntentarSalir);
  }, [haycambios]);

  return (
    <div className="space-y-4">
      <Link
        to={rutaVolver}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={14} /> {etiquetaVolver}
      </Link>

      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{titulo}</h1>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">{children}</div>
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40 lg:sticky lg:top-4 lg:w-80 lg:shrink-0">
          <div className="flex flex-col gap-4">{resumen}</div>
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">{acciones}</div>
        </div>
      </div>

      {blocker.state === 'blocked' && (
        <Modal titulo="¿Salir sin guardar?" onClose={() => blocker.reset()}>
          <p className="text-sm text-slate-600 dark:text-slate-300">Hay cambios sin guardar en este documento. Si salís ahora, se pierden.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variante="secundario" onClick={() => blocker.reset()}>
              Seguir editando
            </Button>
            <Button type="button" variante="peligro" onClick={() => blocker.proceed()}>
              Salir sin guardar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
