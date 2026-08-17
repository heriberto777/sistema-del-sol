import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../../molecules/FormField/FormField';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Bodega {
  id: string;
  nombre: string;
}

type EstadoTurno = 'ABIERTO' | 'CERRADO';

interface Cajero {
  id: string;
  nombre: string;
}

interface TurnoCaja {
  id: string;
  bodegaId: string;
  montoInicial: string;
  estado: EstadoTurno;
  abiertoEn: string;
  cajero: Cajero;
  cerradoPor: Cajero | null;
}

interface TurnosCajaTableProps {
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
}

export function TurnosCajaTable({ seleccionadoId, onSeleccionar }: TurnosCajaTableProps) {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [bodegaId, setBodegaId] = useState('');
  const [montoInicial, setMontoInicial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filtroCajeroId, setFiltroCajeroId] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');

  const { data: bodegas } = useQuery({
    queryKey: ['inventario-bodegas'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  const { data: cajeros } = useQuery({
    queryKey: ['pos-cajeros'],
    queryFn: async () => (await apiClient.get<Cajero[]>('/pos/cajeros')).data,
  });

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['pos-turnos', pagina, filtroCajeroId, filtroEstado, filtroDesde, filtroHasta],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<TurnoCaja>>('/pos/turnos', {
          params: {
            pagina,
            cajeroId: filtroCajeroId || undefined,
            estado: filtroEstado || undefined,
            desde: filtroDesde || undefined,
            hasta: filtroHasta || undefined,
          },
        })
      ).data,
  });

  const abrir = useMutation({
    mutationFn: async () => apiClient.post('/pos/turnos', { bodegaId, montoInicial: Number(montoInicial) }),
    onSuccess: (respuesta) => {
      queryClient.invalidateQueries({ queryKey: ['pos-turnos'] });
      onSeleccionar(respuesta.data.id);
      setMontoInicial('');
      setError(null);
    },
    onError: () => setError('No se pudo abrir el turno — esa bodega ya podría tener uno abierto.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    abrir.mutate();
  }

  return (
    <div className="space-y-4">
      {tienePermiso('pos.editar') && (
      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Bodega</label>
          <select
            value={bodegaId}
            onChange={(e) => setBodegaId(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Seleccionar…</option>
            {bodegas?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>
        <FormField
          id="turno-monto-inicial"
          label="Efectivo inicial"
          type="number"
          min={0}
          step="any"
          value={montoInicial}
          onChange={(e) => setMontoInicial(e.target.value)}
          required
          className="w-40"
        />
        <Button type="submit" disabled={abrir.isPending}>
          {abrir.isPending ? 'Abriendo…' : 'Abrir turno'}
        </Button>
      </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Cajero</label>
          <select
            value={filtroCajeroId}
            onChange={(e) => {
              setFiltroCajeroId(e.target.value);
              setPagina(1);
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Todos</option>
            {cajeros?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Estado</label>
          <select
            value={filtroEstado}
            onChange={(e) => {
              setFiltroEstado(e.target.value);
              setPagina(1);
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Todos</option>
            <option value="ABIERTO">Abierto</option>
            <option value="CERRADO">Cerrado</option>
          </select>
        </div>
        <FormField id="turnos-filtro-desde" label="Desde" type="date" value={filtroDesde} onChange={(e) => { setFiltroDesde(e.target.value); setPagina(1); }} className="w-36" />
        <FormField id="turnos-filtro-hasta" label="Hasta" type="date" value={filtroHasta} onChange={(e) => { setFiltroHasta(e.target.value); setPagina(1); }} className="w-36" />
      </div>

      {isLoading && <p className="text-sm text-slate-500">Cargando turnos…</p>}
      {errorCarga && <p className="text-sm text-red-600">No se pudieron cargar los turnos.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Bodega</th>
                  <th className="px-4 py-2">Cajero</th>
                  <th className="px-4 py-2">Monto inicial</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Abierto</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.datos.map((turno) => (
                  <tr key={turno.id} className={turno.id === seleccionadoId ? 'bg-sol-50 dark:bg-sol-900/20' : ''}>
                    <td className="px-4 py-2">{bodegas?.find((b) => b.id === turno.bodegaId)?.nombre ?? turno.bodegaId}</td>
                    <td className="px-4 py-2">
                      {turno.cajero.nombre}
                      {turno.estado === 'CERRADO' && turno.cerradoPor && turno.cerradoPor.id !== turno.cajero.id && (
                        <span className="block text-xs text-slate-400">Cerrado por {turno.cerradoPor.nombre}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">RD$ {Number(turno.montoInicial).toLocaleString('es-DO')}</td>
                    <td className="px-4 py-2">
                      <Badge tono={turno.estado === 'ABIERTO' ? 'exito' : 'neutro'}>{turno.estado}</Badge>
                    </td>
                    <td className="px-4 py-2">{new Date(turno.abiertoEn).toLocaleString('es-DO')}</td>
                    <td className="px-4 py-2">
                      <Button variante="secundario" onClick={() => onSeleccionar(turno.id)}>
                        Ver detalle
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
        </>
      )}
    </div>
  );
}
