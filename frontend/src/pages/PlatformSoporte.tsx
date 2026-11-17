import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApiClient } from '../lib/platform-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

type Categoria = 'BUG' | 'DUDA' | 'SOLICITUD' | 'OTRO';
type Estado = 'NUEVO' | 'EN_REVISION' | 'RESUELTO';

interface ReporteTenantPlataforma {
  id: string;
  asunto: string;
  descripcion: string;
  categoria: Categoria;
  estado: Estado;
  respuesta: string | null;
  respondidoEn: string | null;
  createdAt: string;
  tenant: { id: string; nombre: string; subdominio: string };
  usuario: { id: string; nombre: string; email: string | null };
  respondidoPor: { id: string; nombre: string } | null;
}

const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  BUG: 'Algo no funciona',
  DUDA: 'Duda',
  SOLICITUD: 'Solicitud / idea',
  OTRO: 'Otro',
};

const ETIQUETA_ESTADO: Record<Estado, string> = { NUEVO: 'Nuevo', EN_REVISION: 'En revisión', RESUELTO: 'Resuelto' };
const TONO_ESTADO: Record<Estado, 'neutro' | 'advertencia' | 'exito'> = { NUEVO: 'advertencia', EN_REVISION: 'neutro', RESUELTO: 'exito' };

/** Lado plataforma de "Reportar un problema" — lista TODOS los tenants, responder cambia estado + deja una respuesta visible para el tenant. */
export function PlatformSoporte() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [reporteRespondiendo, setReporteRespondiendo] = useState<ReporteTenantPlataforma | null>(null);

  const { data } = useQuery({
    queryKey: ['platform-reportes-tenant', pagina, busquedaDebounced, estadoFiltro],
    queryFn: async () =>
      (
        await platformApiClient.get<PaginaResultado<ReporteTenantPlataforma>>('/platform/reportes-tenant', {
          params: { pagina, busqueda: busquedaDebounced || undefined, estado: estadoFiltro || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Soporte</h1>

      <Card
        sinPadding
        titulo="Reportes de tenants"
        descripcion={data ? `${data.total} reporte(s)` : undefined}
        acciones={
          <div className="flex items-center gap-2">
            <Select
              value={estadoFiltro}
              onChange={(e) => {
                setEstadoFiltro(e.target.value);
                setPagina(1);
              }}
              className="!w-auto"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Select>
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por asunto o tenant…"
            />
          </div>
        }
      >
        {data?.datos.length === 0 ? (
          <div className="p-5">
            <EstadoVacio titulo="Sin reportes" descripcion="Todavía ningún tenant reportó nada con este filtro." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Tenant</th>
                  <th className="px-5 py-3 font-medium">Asunto</th>
                  <th className="px-5 py-3 font-medium">Categoría</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.datos.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{r.tenant.nombre}</p>
                      <p className="text-xs text-slate-400">{r.usuario.nombre}</p>
                    </td>
                    <td className="px-5 py-3">{r.asunto}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{ETIQUETA_CATEGORIA[r.categoria]}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{new Date(r.createdAt).toLocaleDateString('es-DO')}</td>
                    <td className="px-5 py-3">
                      <Badge tono={TONO_ESTADO[r.estado]}>{ETIQUETA_ESTADO[r.estado]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variante="secundario" onClick={() => setReporteRespondiendo(r)}>
                        {r.respuesta ? 'Ver / responder' : 'Responder'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>

      {reporteRespondiendo && (
        <ModalResponderReporte
          reporte={reporteRespondiendo}
          onClose={() => setReporteRespondiendo(null)}
          onRespondido={() => queryClient.invalidateQueries({ queryKey: ['platform-reportes-tenant'] })}
        />
      )}
    </div>
  );
}

function ModalResponderReporte({
  reporte,
  onClose,
  onRespondido,
}: {
  reporte: ReporteTenantPlataforma;
  onClose: () => void;
  onRespondido: () => void;
}) {
  const [respuesta, setRespuesta] = useState(reporte.respuesta ?? '');
  const [estado, setEstado] = useState<Estado>(reporte.estado === 'NUEVO' ? 'EN_REVISION' : reporte.estado);
  const [error, setError] = useState<string | null>(null);

  const responder = useMutation({
    mutationFn: async () => platformApiClient.patch(`/platform/reportes-tenant/${reporte.id}`, { estado, respuesta: respuesta || undefined }),
    onSuccess: () => {
      onRespondido();
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la respuesta.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    responder.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{reporte.asunto}</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {reporte.tenant.nombre} ({reporte.tenant.subdominio}) — {reporte.usuario.nombre}
          {reporte.usuario.email && ` · ${reporte.usuario.email}`}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{reporte.descripcion}</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex flex-col gap-1">
            <label htmlFor="respuesta-estado" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Estado
            </label>
            <Select id="respuesta-estado" value={estado} onChange={(e) => setEstado(e.target.value as Estado)}>
              {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="respuesta-texto" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Respuesta (opcional — la ve el tenant)
            </label>
            <textarea
              id="respuesta-texto"
              rows={4}
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variante="secundario" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={responder.isPending}>
              {responder.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
