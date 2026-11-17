import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface ProyectoResumen {
  id: string;
  nombre: string;
  cliente: { id: string; nombre: string };
  responsable: { id: string; nombre: string } | null;
  estado: string;
  presupuesto: string | null;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  PLANIFICADO: 'Planificado',
  EN_CURSO: 'En curso',
  PAUSADO: 'Pausado',
  TERMINADO: 'Terminado',
  CANCELADO: 'Cancelado',
};

export function Proyectos() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data, isLoading } = useQuery({
    queryKey: ['proyectos', pagina, busquedaDebounced],
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<ProyectoResumen>>('/admin/proyectos', { params: { pagina, busqueda: busquedaDebounced || undefined } })).data,
  });

  const proyectos = data?.datos ?? [];

  return (
    <RequierePermiso permiso="proyectos.ver">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Proyectos</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Proyectos por cliente, con hitos, tareas y horas registradas.</p>
          </div>
          <RequierePermiso permiso="proyectos.crear">
            <Button onClick={() => navigate('/proyectos/nuevo')}>Nuevo proyecto</Button>
          </RequierePermiso>
        </div>

        <Card contentClassName="flex flex-wrap items-center gap-3" sinPadding>
          <div className="flex w-full items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar proyecto…" />
          </div>

          {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {!isLoading && proyectos.length === 0 && (
            <div className="w-full p-5">
              <EstadoVacio titulo="Sin proyectos todavía" descripcion="Creá el primero para empezar a asignar tareas y registrar horas." />
            </div>
          )}
          {proyectos.length > 0 && (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-800">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Responsable</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Presupuesto</th>
                </tr>
              </thead>
              <tbody>
                {proyectos.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/proyectos/${p.id}/resumen`)}
                    className="cursor-pointer border-b border-slate-50 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{p.nombre}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.cliente.nombre}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.responsable?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ETIQUETA_ESTADO[p.estado] ?? p.estado}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.presupuesto ? `RD$ ${Number(p.presupuesto).toLocaleString('es-DO')}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {data && (
            <div className="w-full border-t border-slate-100 p-4 dark:border-slate-800">
              <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>
      </div>
    </RequierePermiso>
  );
}
