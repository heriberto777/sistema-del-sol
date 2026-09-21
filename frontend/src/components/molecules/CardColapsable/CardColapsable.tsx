import { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CardColapsableProps {
  titulo: string;
  descripcion?: string;
  /** Resumen de una línea que se muestra cuando está contraída — ej. "Ferretería Dominicana SRL · Contado · Consumo (B02)". */
  resumen: ReactNode;
  colapsada: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Variante de `Card` que puede contraerse a una sola línea de resumen —
 * Modelo A de la exploración "más espacio para líneas": en Factura/
 * Cotización/Remisión, "Información" (cliente, bodega, comprobante...)
 * competía por altura con la tabla de líneas, que puede crecer mucho más.
 * Arranca expandida; cada página decide cuándo contraerla sola (ej. al
 * elegir el cliente) y siempre se puede volver a abrir a mano con el
 * chevron. No se generalizó en `Card` (usado en decenas de pantallas sin
 * esta necesidad) para no cargarlo con un caso de uso puntual.
 */
export function CardColapsable({ titulo, descripcion, resumen, colapsada, onToggle, children }: CardColapsableProps) {
  if (colapsada) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600 dark:text-slate-300">{resumen}</span>
        <span className="shrink-0 text-xs font-medium text-sol-600 dark:text-sol-400">Editar</span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Contraer"
          title="Contraer"
        >
          <ChevronUp size={18} />
        </button>
      </header>
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}
