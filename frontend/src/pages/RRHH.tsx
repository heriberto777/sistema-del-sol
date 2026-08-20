import { useState } from 'react';
import clsx from 'clsx';
import { HorarioEmpleadoPanel } from '../components/organisms/HorarioEmpleadoPanel/HorarioEmpleadoPanel';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

const PESTANAS = [{ id: 'horarios', etiqueta: 'Horarios' }] as const;

type PestanaId = (typeof PESTANAS)[number]['id'];

export function RRHH() {
  const [pestana, setPestana] = useState<PestanaId>('horarios');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">RRHH</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Horarios, asistencia y ausencias del personal.</p>
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

      <RequierePermiso permiso="rrhh.ver">{pestana === 'horarios' && <HorarioEmpleadoPanel />}</RequierePermiso>
    </div>
  );
}
