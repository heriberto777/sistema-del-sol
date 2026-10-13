import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { Card } from '../components/atoms/Card/Card';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { FormField } from '../components/molecules/FormField/FormField';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { Modal } from '../components/molecules/Modal/Modal';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { Tabs, type Pestana } from '../components/molecules/Tabs/Tabs';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

type PestanaAuditoria = 'actividad' | 'errores';

const PESTANAS: readonly Pestana<PestanaAuditoria>[] = [
  { id: 'actividad', etiqueta: 'Actividad' },
  { id: 'errores', etiqueta: 'Errores del sistema' },
];

interface RegistroActividad {
  id: string;
  createdAt: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  ip: string | null;
  user: { id: string; nombre: string; email: string } | null;
}

interface RegistroError {
  id: string;
  createdAt: string;
  metodo: string;
  ruta: string;
  statusCode: number;
  mensaje: string;
  stack: string | null;
  user: { id: string; nombre: string; email: string } | null;
}

interface UsuarioConActividad {
  id: string;
  nombre: string;
}

/**
 * `AuditLog` se graba solo desde hace tiempo vía AuditLogInterceptor
 * (global) — esta pantalla es la primera que lo expone. Los errores 500 sí
 * son nuevos (antes solo iban a console.error, ver HttpExceptionFilter).
 */
export function Auditoria() {
  const [pestana, setPestana] = useState<PestanaAuditoria>('actividad');

  return (
    <RequierePermiso permiso="auditoria.ver">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Auditoría y Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Quién hizo qué en el sistema, y los errores internos que ocurrieron en el camino.
          </p>
        </div>

        <Tabs pestanas={PESTANAS} activa={pestana} onCambiar={setPestana} />

        {pestana === 'actividad' ? <PestanaActividad /> : <PestanaErrores />}
      </div>
    </RequierePermiso>
  );
}

function PestanaActividad() {
  const [busqueda, setBusqueda] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data: usuarios } = useQuery({
    queryKey: ['auditoria-usuarios'],
    queryFn: async () => (await apiClient.get<UsuarioConActividad[]>('/auditoria/usuarios')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['auditoria-actividad', pagina, busquedaDebounced, usuarioId, desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<RegistroActividad>>('/auditoria', {
          params: { pagina, busqueda: busquedaDebounced || undefined, usuarioId: usuarioId || undefined, desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  return (
    <Card sinPadding>
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
        <div className="min-w-[220px] flex-1">
          <SearchInput
            value={busqueda}
            onChange={(v) => {
              setBusqueda(v);
              setPagina(1);
            }}
            placeholder="Buscar por acción o entidad…"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Usuario</label>
          <select
            value={usuarioId}
            onChange={(e) => {
              setUsuarioId(e.target.value);
              setPagina(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Todos</option>
            {usuarios?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <FormField
          id="auditoria-desde"
          label="Desde"
          type="date"
          value={desde}
          onChange={(e) => {
            setDesde(e.target.value);
            setPagina(1);
          }}
        />
        <FormField
          id="auditoria-hasta"
          label="Hasta"
          type="date"
          value={hasta}
          onChange={(e) => {
            setHasta(e.target.value);
            setPagina(1);
          }}
        />
      </div>

      {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
      {!isLoading && data?.datos.length === 0 && (
        <div className="p-5">
          <EstadoVacio titulo="Sin actividad" descripcion="No hay registros de auditoría con estos filtros." />
        </div>
      )}
      {!isLoading && data && data.datos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Acción</th>
                <th className="px-5 py-3 font-medium">Entidad</th>
                <th className="px-5 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.datos.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-700 dark:text-slate-300">{new Date(r.createdAt).toLocaleString('es-DO')}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{r.user?.nombre ?? 'Sistema'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{r.accion}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                    {r.entidad}
                    {r.entidadId && <span className="ml-1 text-xs text-slate-400">#{r.entidadId.slice(0, 8)}</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">{r.ip ?? '—'}</td>
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
  );
}

function PestanaErrores() {
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [errorViendo, setErrorViendo] = useState<RegistroError | null>(null);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data, isLoading } = useQuery({
    queryKey: ['auditoria-errores', pagina, busquedaDebounced, desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<RegistroError>>('/auditoria/errores', {
          params: { pagina, busqueda: busquedaDebounced || undefined, desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  return (
    <Card sinPadding>
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
        <div className="min-w-[220px] flex-1">
          <SearchInput
            value={busqueda}
            onChange={(v) => {
              setBusqueda(v);
              setPagina(1);
            }}
            placeholder="Buscar por mensaje o ruta…"
          />
        </div>
        <FormField
          id="errores-desde"
          label="Desde"
          type="date"
          value={desde}
          onChange={(e) => {
            setDesde(e.target.value);
            setPagina(1);
          }}
        />
        <FormField
          id="errores-hasta"
          label="Hasta"
          type="date"
          value={hasta}
          onChange={(e) => {
            setHasta(e.target.value);
            setPagina(1);
          }}
        />
      </div>

      {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
      {!isLoading && data?.datos.length === 0 && (
        <div className="p-5">
          <EstadoVacio titulo="Sin errores" descripcion="No se registró ningún error del sistema con estos filtros — buena señal." />
        </div>
      )}
      {!isLoading && data && data.datos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Ruta</th>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Mensaje</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.datos.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-700 dark:text-slate-300">{new Date(r.createdAt).toLocaleString('es-DO')}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{r.user?.nombre ?? '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {r.metodo} {r.ruta}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {r.statusCode}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-5 py-3 text-slate-700 dark:text-slate-300" title={r.mensaje}>
                    {r.mensaje}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button type="button" onClick={() => setErrorViendo(r)} className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400">
                      Ver detalle
                    </button>
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

      {errorViendo && (
        <Modal titulo={`Error — ${new Date(errorViendo.createdAt).toLocaleString('es-DO')}`} onClose={() => setErrorViendo(null)} ancho="xl">
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-medium text-slate-700 dark:text-slate-300">Usuario: </span>
              {errorViendo.user?.nombre ?? '—'}
            </p>
            <p>
              <span className="font-medium text-slate-700 dark:text-slate-300">Ruta: </span>
              <span className="font-mono text-xs">
                {errorViendo.metodo} {errorViendo.ruta}
              </span>
            </p>
            <p>
              <span className="font-medium text-slate-700 dark:text-slate-300">Mensaje: </span>
              {errorViendo.mensaje}
            </p>
            {errorViendo.stack && (
              <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-200">{errorViendo.stack}</pre>
            )}
          </div>
        </Modal>
      )}
    </Card>
  );
}
