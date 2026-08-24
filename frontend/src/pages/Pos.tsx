import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { AbrirTurnoForm } from '../components/organisms/AbrirTurnoForm/AbrirTurnoForm';
import { TurnosCajaTable } from '../components/organisms/TurnosCajaTable/TurnosCajaTable';
import { CierresCajaDashboard } from '../components/organisms/CierresCajaDashboard/CierresCajaDashboard';
import { Button } from '../components/atoms/Button/Button';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { esCajeroPuro } from '../contexts/AuthContext';
import { PaginaResultado } from '../types/pagina-resultado';

interface Bodega {
  id: string;
  nombre: string;
  sucursalId: string;
}

interface TurnoCajaResumen {
  id: string;
}

export function Pos() {
  const { usuario, tienePermiso } = useAuth();
  const navigate = useNavigate();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const esCajero = esCajeroPuro(usuario);

  if (esCajero) return <PosCajero />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Punto de venta</h1>
      <RequierePermiso permiso="pos.ver">
        {tienePermiso('pos.supervisar') && <MensajeCajasSupervisorPanel />}
        {tienePermiso('pos.supervisar') && <CierresCajaDashboard />}
        <TurnosCajaTable seleccionadoId={seleccionadoId} onSeleccionar={setSeleccionadoId} />
        {seleccionadoId && (
          <div className="flex justify-end">
            <Button onClick={() => navigate(`/pos/caja/${seleccionadoId}`)}>Entrar a la caja →</Button>
          </div>
        )}
      </RequierePermiso>
    </div>
  );
}

interface MensajeCajas {
  texto: string;
  fecha: string;
}

/** "Mensaje a cajas" (plan de integración Cuadre, ítem J-3) — publicar/borrar el aviso que ven todos los terminales POS (`pos.supervisar`). */
function MensajeCajasSupervisorPanel() {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');

  const { data: mensajeActual } = useQuery({
    queryKey: ['pos-mensaje-cajas'],
    queryFn: async () => (await apiClient.get<MensajeCajas | null>('/pos/mensaje-cajas')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['pos-mensaje-cajas'] });
  }

  const publicar = useMutation({
    mutationFn: async () => apiClient.post('/pos/mensaje-cajas', { texto }),
    onSuccess: () => {
      invalidar();
      setTexto('');
    },
  });

  const borrar = useMutation({
    mutationFn: async () => apiClient.delete('/pos/mensaje-cajas'),
    onSuccess: invalidar,
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Mensaje a cajas</p>
      {mensajeActual && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <span>Activo: {mensajeActual.texto}</span>
          <button
            type="button"
            onClick={() => borrar.mutate()}
            disabled={borrar.isPending}
            className="shrink-0 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            Borrar
          </button>
        </div>
      )}
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (texto.trim()) publicar.mutate();
        }}
        className="flex gap-2"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej: Cierre anticipado hoy a las 6pm"
          maxLength={280}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <Button type="submit" disabled={publicar.isPending || !texto.trim()}>
          {publicar.isPending ? 'Publicando…' : 'Publicar'}
        </Button>
      </form>
    </div>
  );
}

/**
 * Vista para un cajero puro (rol Cajero, ver `esCajeroPuro`): sin la tabla
 * de todos los turnos de todos los cajeros — no le sirve de nada, no
 * puede abrir/cerrar el turno de otro (`pos.supervisar`). Aterriza
 * directo en `/pos/caja/:id` (pantalla completa) si ya tiene un turno
 * abierto, o en el formulario de apertura si no — nunca ve una pantalla
 * vacía sin saber qué hacer, que era el problema original.
 */
function PosCajero() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

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
    if (miTurnoAbierto) navigate(`/pos/caja/${miTurnoAbierto.id}`, { replace: true });
  }, [miTurnoAbierto, navigate]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Punto de venta</h1>

      <RequierePermiso permiso="pos.ver">
        {(isLoading || miTurnoAbierto) && <p className="text-sm text-slate-500">Cargando tu turno…</p>}

        {!isLoading && !miTurnoAbierto && (
          <div className="mx-auto max-w-sm space-y-3 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No tenés un turno de caja abierto — abrí uno para empezar a vender.
            </p>
            <AbrirTurnoForm bodegas={bodegas ?? []} onAbierto={(id) => navigate(`/pos/caja/${id}`)} />
          </div>
        )}
      </RequierePermiso>
    </div>
  );
}
