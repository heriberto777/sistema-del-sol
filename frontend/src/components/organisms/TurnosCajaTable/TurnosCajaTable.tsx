import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { AbrirTurnoForm } from '../AbrirTurnoForm/AbrirTurnoForm';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { useAuth } from '../../../hooks/useAuth';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Bodega {
  id: string;
  nombre: string;
  sucursalId: string;
}

type EstadoTurno = 'ABIERTO' | 'PENDIENTE_REVISION' | 'CERRADO';

const TONO_ESTADO: Record<EstadoTurno, 'exito' | 'advertencia' | 'neutro'> = {
  ABIERTO: 'exito',
  PENDIENTE_REVISION: 'advertencia',
  CERRADO: 'neutro',
};

const ETIQUETA_ESTADO: Record<EstadoTurno, string> = {
  ABIERTO: 'ABIERTO',
  PENDIENTE_REVISION: 'PENDIENTE DE REVISIÓN',
  CERRADO: 'CERRADO',
};

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

export function TurnosCajaTable() {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const queryClient = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [modalAbrirTurno, setModalAbrirTurno] = useState(false);
  const [filtroCajeroId, setFiltroCajeroId] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data: bodegas } = useQuery({
    queryKey: ['inventario-bodegas'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  const { data: cajeros } = useQuery({
    queryKey: ['pos-cajeros'],
    queryFn: async () => (await apiClient.get<Cajero[]>('/pos/cajeros')).data,
  });

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['pos-turnos', pagina, filtroCajeroId, filtroEstado, filtroDesde, filtroHasta, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<TurnoCaja>>('/pos/turnos', {
          params: {
            pagina,
            cajeroId: filtroCajeroId || undefined,
            estado: filtroEstado || undefined,
            desde: filtroDesde || undefined,
            hasta: filtroHasta || undefined,
            busqueda: busquedaDebounced || undefined,
          },
        })
      ).data,
  });

  const revisar = useMutation({
    mutationFn: async (turnoId: string) => apiClient.patch(`/pos/turnos/${turnoId}/revisar`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pos-turnos'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Turnos de caja</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Apertura, cierre y arqueo por cajero.</p>
        </div>
        {tienePermiso('pos.editar') && <Button onClick={() => setModalAbrirTurno(true)}>Abrir turno</Button>}
      </div>

      <Card contentClassName="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Cajero</label>
          <select
            value={filtroCajeroId}
            onChange={(e) => {
              setFiltroCajeroId(e.target.value);
              setPagina(1);
            }}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Todos</option>
            <option value="ABIERTO">Abierto</option>
            <option value="PENDIENTE_REVISION">Pendiente de revisión</option>
            <option value="CERRADO">Cerrado</option>
          </select>
        </div>
        <FormField id="turnos-filtro-desde" label="Desde" type="date" value={filtroDesde} onChange={(e) => { setFiltroDesde(e.target.value); setPagina(1); }} className="w-36" />
        <FormField id="turnos-filtro-hasta" label="Hasta" type="date" value={filtroHasta} onChange={(e) => { setFiltroHasta(e.target.value); setPagina(1); }} className="w-36" />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Buscar cajero</label>
          <SearchInput
            value={busqueda}
            onChange={(v) => {
              setBusqueda(v);
              setPagina(1);
            }}
            placeholder="Nombre del cajero…"
          />
        </div>
      </Card>

      {isLoading && <p className="text-sm text-slate-500">Cargando turnos…</p>}
      {errorCarga && <p className="text-sm text-red-600">No se pudieron cargar los turnos.</p>}

      {data && (
        <>
          <Card sinPadding className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Bodega</th>
                  <th className="px-5 py-3 font-medium">Cajero</th>
                  <th className="px-5 py-3 font-medium">Monto inicial</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Abierto</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.datos.map((turno) => (
                  <tr key={turno.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{bodegas?.find((b) => b.id === turno.bodegaId)?.nombre ?? turno.bodegaId}</td>
                    <td className="px-5 py-3">
                      {turno.cajero.nombre}
                      {turno.estado === 'CERRADO' && turno.cerradoPor && turno.cerradoPor.id !== turno.cajero.id && (
                        <span className="block text-xs text-slate-400">Cerrado por {turno.cerradoPor.nombre}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">RD$ {Number(turno.montoInicial).toLocaleString('es-DO')}</td>
                    <td className="px-5 py-3">
                      <Badge tono={TONO_ESTADO[turno.estado]}>{ETIQUETA_ESTADO[turno.estado]}</Badge>
                    </td>
                    <td className="px-5 py-3">{new Date(turno.abiertoEn).toLocaleString('es-DO')}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <Button variante="secundario" onClick={() => navigate(`/pos/caja/${turno.id}`)}>
                          {turno.estado === 'ABIERTO' ? 'Entrar a la caja' : 'Ver detalle'}
                        </Button>
                        {turno.estado === 'PENDIENTE_REVISION' && tienePermiso('pos.supervisar') && (
                          <Button disabled={revisar.isPending} onClick={() => revisar.mutate(turno.id)}>
                            Marcar revisado
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
        </>
      )}

      {modalAbrirTurno && (
        <ModalAbrirTurno
          bodegas={bodegas ?? []}
          onClose={() => setModalAbrirTurno(false)}
          onAbierto={(turnoId) => {
            setModalAbrirTurno(false);
            navigate(`/pos/caja/${turnoId}`);
          }}
        />
      )}
    </div>
  );
}

function ModalAbrirTurno({
  bodegas,
  onClose,
  onAbierto,
}: {
  bodegas: Bodega[];
  onClose: () => void;
  onAbierto: (turnoId: string) => void;
}) {
  return (
    <Modal titulo="Abrir turno" onClose={onClose}>
      <AbrirTurnoForm bodegas={bodegas} onAbierto={onAbierto} />
    </Modal>
  );
}
