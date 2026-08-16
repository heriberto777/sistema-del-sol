import { Button } from '../../atoms/Button/Button';

interface EstadoVacioProps {
  titulo: string;
  descripcion?: string;
  etiquetaAccion?: string;
  onAccion?: () => void;
}

export function EstadoVacio({ titulo, descripcion, etiquetaAccion, onAccion }: EstadoVacioProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="font-medium text-slate-900 dark:text-slate-100">{titulo}</p>
      {descripcion && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>}
      {etiquetaAccion && onAccion && (
        <Button onClick={onAccion} className="mt-2">
          {etiquetaAccion}
        </Button>
      )}
    </div>
  );
}
