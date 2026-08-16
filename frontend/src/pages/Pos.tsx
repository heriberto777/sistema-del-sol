import { useState } from 'react';
import { TurnosCajaTable } from '../components/organisms/TurnosCajaTable/TurnosCajaTable';
import { TurnoCajaDetalle } from '../components/organisms/TurnoCajaDetalle/TurnoCajaDetalle';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

export function Pos() {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Punto de venta</h1>
      <RequierePermiso permiso="pos.ver">
        <TurnosCajaTable seleccionadoId={seleccionadoId} onSeleccionar={setSeleccionadoId} />
        {seleccionadoId && <TurnoCajaDetalle turnoId={seleccionadoId} />}
      </RequierePermiso>
    </div>
  );
}
