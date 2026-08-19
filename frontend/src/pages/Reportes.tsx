import { useState } from 'react';
import clsx from 'clsx';
import { ReporteVentas } from '../components/organisms/ReporteVentas/ReporteVentas';
import { ReporteInventario } from '../components/organisms/ReporteInventario/ReporteInventario';
import { ReporteCompras } from '../components/organisms/ReporteCompras/ReporteCompras';
import { ReporteFiscalDgii } from '../components/organisms/ReporteFiscalDgii/ReporteFiscalDgii';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

const PESTANAS = [
  { id: 'ventas', etiqueta: 'Ventas' },
  { id: 'inventario', etiqueta: 'Inventario' },
  { id: 'compras', etiqueta: 'Compras' },
  { id: 'dgii', etiqueta: 'DGII' },
] as const;

type PestanaId = (typeof PESTANAS)[number]['id'];

export function Reportes() {
  const [pestana, setPestana] = useState<PestanaId>('ventas');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Reportes</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Ventas, inventario, compras y reportes fiscales DGII.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={clsx(
              'border-b-2 px-3 py-2 text-sm font-medium',
              pestana === p.id
                ? 'border-sol-500 text-sol-600 dark:text-sol-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400',
            )}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <RequierePermiso permiso="reportes.ver">
        {pestana === 'ventas' && <ReporteVentas />}
        {pestana === 'inventario' && <ReporteInventario />}
        {pestana === 'compras' && <ReporteCompras />}
        {pestana === 'dgii' && <ReporteFiscalDgii />}
      </RequierePermiso>
    </div>
  );
}
