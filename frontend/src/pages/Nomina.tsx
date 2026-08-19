import { useState } from 'react';
import clsx from 'clsx';
import { EmpleadosTable } from '../components/organisms/EmpleadosTable/EmpleadosTable';
import { PeriodosNominaTable } from '../components/organisms/PeriodosNominaTable/PeriodosNominaTable';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

const PESTANAS = [
  { id: 'empleados', etiqueta: 'Empleados' },
  { id: 'periodos', etiqueta: 'Períodos' },
] as const;

type PestanaId = (typeof PESTANAS)[number]['id'];

export function Nomina() {
  const [pestana, setPestana] = useState<PestanaId>('empleados');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Nómina</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Empleados, períodos y recibos de pago.</p>
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

      <RequierePermiso permiso="nomina.ver">
        {pestana === 'empleados' && <EmpleadosTable />}
        {pestana === 'periodos' && <PeriodosNominaTable />}
      </RequierePermiso>
    </div>
  );
}
