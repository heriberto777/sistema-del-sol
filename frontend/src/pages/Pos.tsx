import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { AbrirTurnoForm } from '../components/organisms/AbrirTurnoForm/AbrirTurnoForm';
import { TurnosCajaTable } from '../components/organisms/TurnosCajaTable/TurnosCajaTable';
import { TurnoCajaDetalle } from '../components/organisms/TurnoCajaDetalle/TurnoCajaDetalle';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { esCajeroPuro } from '../contexts/AuthContext';
import { PaginaResultado } from '../types/pagina-resultado';

interface Bodega {
  id: string;
  nombre: string;
}

interface TurnoCajaResumen {
  id: string;
}

export function Pos() {
  const { usuario } = useAuth();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const esCajero = esCajeroPuro(usuario);

  if (esCajero) return <PosCajero />;

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

/**
 * Vista para un cajero puro (rol Cajero, ver `esCajeroPuro`): sin la tabla
 * de todos los turnos de todos los cajeros — no le sirve de nada, no
 * puede abrir/cerrar el turno de otro (`pos.supervisar`). Aterriza
 * directo en su propio turno abierto si ya tiene uno, o en el
 * formulario de apertura si no — nunca ve una pantalla vacía sin saber
 * qué hacer, que era el problema original.
 */
function PosCajero() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const { data: bodegas } = useQuery({
    queryKey: ['inventario-bodegas'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  const { data: miTurnoAbierto, isLoading } = useQuery({
    queryKey: ['pos-mi-turno-abierto', usuario?.id],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<TurnoCajaResumen>>('/pos/turnos', {
          params: { cajeroId: usuario!.id, estado: 'ABIERTO', tamanoPagina: 1 },
        })
      ).data.datos[0] ?? null,
    enabled: !!usuario,
  });

  useEffect(() => {
    if (miTurnoAbierto) setSeleccionadoId(miTurnoAbierto.id);
  }, [miTurnoAbierto]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Punto de venta</h1>

      <RequierePermiso permiso="pos.ver">
        {isLoading && <p className="text-sm text-slate-500">Cargando tu turno…</p>}

        {!isLoading && !miTurnoAbierto && (
          <div className="mx-auto max-w-sm space-y-3 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No tenés un turno de caja abierto — abrí uno para empezar a vender.
            </p>
            <AbrirTurnoForm bodegas={bodegas ?? []} onAbierto={setSeleccionadoId} />
          </div>
        )}

        {seleccionadoId && (
          <TurnoCajaDetalle
            turnoId={seleccionadoId}
            onCerrado={() => queryClient.invalidateQueries({ queryKey: ['pos-mi-turno-abierto'] })}
          />
        )}
      </RequierePermiso>
    </div>
  );
}
