import { type LucideIcon } from 'lucide-react';
import { Card } from '../../atoms/Card/Card';

interface StatCardProps {
  etiqueta: string;
  valor: string;
  variacion?: string;
  icono?: LucideIcon;
}

export function StatCard({ etiqueta, valor, variacion, icono: Icono }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{etiqueta}</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900 dark:text-slate-100">{valor}</p>
          {variacion && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{variacion}</p>}
        </div>
        {Icono && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sol-50 text-sol-600 dark:bg-sol-900/30 dark:text-sol-400">
            <Icono size={20} />
          </div>
        )}
      </div>
    </Card>
  );
}
