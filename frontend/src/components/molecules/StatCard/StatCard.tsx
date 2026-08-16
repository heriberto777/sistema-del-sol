interface StatCardProps {
  etiqueta: string;
  valor: string;
  variacion?: string;
}

export function StatCard({ etiqueta, valor, variacion }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{valor}</p>
      {variacion && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{variacion}</p>}
    </div>
  );
}
