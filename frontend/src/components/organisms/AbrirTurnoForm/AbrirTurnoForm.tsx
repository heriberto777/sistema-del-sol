import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../../molecules/FormField/FormField';
import { useSucursalActiva } from '../../../hooks/useSucursalActiva';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

interface Bodega {
  id: string;
  nombre: string;
  sucursalId: string;
}

interface Caja {
  id: string;
  nombre: string;
  bodegaId: string;
  activa: boolean;
}

interface AbrirTurnoFormProps {
  bodegas: Bodega[];
  onAbierto: (turnoId: string) => void;
}

/**
 * Formulario puro (sin Modal alrededor) para reusar tanto en
 * `ModalAbrirTurno` (TurnosCajaTable, para quien supervisa varios
 * cajeros) como en la apertura forzada de `Pos.tsx` para un cajero puro
 * (rol Cajero) — ahí no hay nada detrás que "cerrar", es la pantalla
 * entera.
 */
export function AbrirTurnoForm({ bodegas, onAbierto }: AbrirTurnoFormProps) {
  const queryClient = useQueryClient();
  const { sucursalActivaId } = useSucursalActiva();
  const [bodegaId, setBodegaId] = useState('');
  const [cajaId, setCajaId] = useState('');
  const [montoInicial, setMontoInicial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bodegasFiltradas = bodegas.filter((b) => !sucursalActivaId || b.sucursalId === sucursalActivaId);

  // Ítem E-7 — "Caja" es opcional: sin elegir una, el turno funciona
  // exactamente igual que antes de este ítem, sin restricción de catálogo.
  const { data: cajas } = useQuery({
    queryKey: ['cajas'],
    queryFn: async () => (await apiClient.get<Caja[]>('/cajas')).data,
  });
  const cajasDeLaBodega = (cajas ?? []).filter((c) => c.activa && c.bodegaId === bodegaId);

  const abrir = useMutation({
    mutationFn: async () => apiClient.post('/pos/turnos', { bodegaId, cajaId: cajaId || undefined, montoInicial: Number(montoInicial) }),
    onSuccess: (respuesta) => {
      queryClient.invalidateQueries({ queryKey: ['pos-turnos'] });
      queryClient.invalidateQueries({ queryKey: ['pos-mi-turno-abierto'] });
      onAbierto(respuesta.data.id);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo abrir el turno — esa bodega ya podría tener uno abierto.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    abrir.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Bodega</label>
        <select
          value={bodegaId}
          onChange={(e) => {
            setBodegaId(e.target.value);
            setCajaId('');
          }}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">Seleccionar…</option>
          {bodegasFiltradas.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </div>
      {cajasDeLaBodega.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Caja (opcional — ítem E-7, restringe qué puede vender esta terminal)
          </label>
          <select
            value={cajaId}
            onChange={(e) => setCajaId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Sin restricción (vende todo el catálogo)</option>
            {cajasDeLaBodega.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      <FormField
        id="turno-monto-inicial"
        label="Efectivo inicial"
        type="number"
        min={0}
        step="any"
        value={montoInicial}
        onChange={(e) => setMontoInicial(e.target.value)}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={abrir.isPending} className="w-full">
        {abrir.isPending ? 'Abriendo…' : 'Abrir turno'}
      </Button>
    </form>
  );
}
